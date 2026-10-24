package com.orangesocial.application.account;

import com.orangesocial.application.account.AccountViews.CategoryView;
import com.orangesocial.application.account.AccountViews.ProfileView;
import com.orangesocial.application.media.ImageSanitizer;
import com.orangesocial.application.media.MediaExceptions;
import com.orangesocial.application.media.MediaUploads;
import com.orangesocial.application.post.PublicLinks;
import com.orangesocial.domain.model.CategoryVerification;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.infrastructure.persistence.postgres.UserControlListRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * RF2 · editar informações pessoais (LGPD Art. 18, III — correção). E-mail e senha têm endpoints próprios com
 * modo sudo; data de nascimento só muda pelo suporte (verificação de idade, ECA Digital); o tipo de usuário
 * não muda por aqui. Conta com selo que troca nome, @usuário ou dados da categoria volta para verificação.
 */
@Service
public class ProfileService {

    private static final Pattern HANDLE = Pattern.compile("^[a-z0-9._]{3,30}$");
    private static final Pattern URL = Pattern.compile("^https://[^\\s]{4,200}$");
    private static final Pattern PHONE = Pattern.compile("^\\+[1-9]\\d{7,14}$");

    private final UserControlListRepository users;
    private final MediaUploads media;
    private final PublicLinks links;

    public ProfileService(UserControlListRepository users, MediaUploads media, PublicLinks links) {
        this.users = users;
        this.media = media;
        this.links = links;
    }

    public record ProfilePatch(String name, String handle, String bio, List<String> pronouns, List<String> links,
                               String countryOfResidence, String stateOfResidence, String cityOfResidence,
                               String gender, String recoveryEmail, String cellphoneNumber,
                               Map<String, Object> typeDetails) {
    }

    @Transactional(readOnly = true)
    public ProfileView get(long userId) {
        return view(users.findById(userId).orElseThrow());
    }

    @Transactional
    public ProfileView update(long userId, ProfilePatch p) {
        UserControlList u = users.findById(userId).orElseThrow();
        List<String> errors = new ArrayList<>();
        boolean identityChanged = false;
        if (p.name() != null) {
            String name = p.name().strip();
            if (name.length() < 2 || name.length() > 120) {
                errors.add("Informe um nome de exibição com 2 a 120 caracteres.");
            } else if (!name.equals(u.getName())) {
                u.setName(name);
                identityChanged = true;
            }
        }
        if (p.handle() != null) {
            String handle = p.handle().strip().toLowerCase(java.util.Locale.ROOT);
            if (!HANDLE.matcher(handle).matches()) {
                errors.add("O @usuário deve ter 3 a 30 caracteres: letras minúsculas, números, ponto ou sublinhado.");
            } else if (!handle.equals(u.getHandle())) {
                if (users.existsByHandle(handle)) {
                    throw new AccountExceptions.Conflict("Esse @usuário já está em uso. Tente outro.");
                }
                u.setHandle(handle);
                identityChanged = true;
            }
        }
        if (p.bio() != null) {
            if (p.bio().length() > 150) {
                errors.add("A bio tem no máximo 150 caracteres.");
            } else {
                u.setBio(p.bio().isBlank() ? null : p.bio().strip());
            }
        }
        if (p.pronouns() != null) {
            if (p.pronouns().size() > 4 || p.pronouns().stream().anyMatch(x -> x == null || x.isBlank() || x.length() > 20)) {
                errors.add("Até 4 pronomes, com até 20 caracteres cada.");
            } else {
                u.setPronouns(p.pronouns().stream().map(String::strip).toList());
            }
        }
        if (p.links() != null) {
            if (p.links().size() > 5 || p.links().stream().anyMatch(l -> l == null || !URL.matcher(l.strip()).matches())) {
                errors.add("Até 5 links, cada um começando com https://");
            } else {
                u.setLinks(p.links().stream().map(String::strip).toList());
            }
        }
        if (p.countryOfResidence() != null) {
            String c = p.countryOfResidence().strip().toUpperCase(java.util.Locale.ROOT);
            if (!c.isEmpty() && !c.matches("[A-Z]{2}")) {
                errors.add("País no formato ISO de 2 letras, ex.: BR.");
            } else {
                u.setCountryOfResidence(c.isEmpty() ? null : c);
            }
        }
        if (p.stateOfResidence() != null) u.setStateOfResidence(blankToNull(p.stateOfResidence()));
        if (p.cityOfResidence() != null) u.setCityOfResidence(blankToNull(p.cityOfResidence()));
        if (p.gender() != null) u.setGender(blankToNull(p.gender()));
        if (p.recoveryEmail() != null) {
            String r = UserControlList.normalizeEmail(p.recoveryEmail());
            if (!r.isEmpty() && (!r.contains("@") || r.equals(u.getEmail()))) {
                errors.add("O e-mail de recuperação precisa ser válido e diferente do e-mail de login.");
            } else {
                u.setRecoveryEmail(r.isEmpty() ? null : r);
            }
        }
        if (p.cellphoneNumber() != null) {
            String phone = p.cellphoneNumber().replaceAll("[\\s()-]", "");
            if (!phone.isEmpty() && !PHONE.matcher(phone).matches()) {
                errors.add("Celular no formato internacional, ex.: +5541999990000.");
            } else {
                u.setCellphoneNumber(phone.isEmpty() ? null : phone);
            }
        }
        if (p.typeDetails() != null) {
            Map<String, Object> details = UserTypeDetailsValidator.validate(u.getUserType(), p.typeDetails());
            if (!Objects.equals(details, u.getTypeDetails())) {
                u.setTypeDetails(details);
                identityChanged = true;
            }
        }
        if (!errors.isEmpty()) {
            throw new AccountExceptions.Invalid(errors);
        }
        if (identityChanged && u.getCategoryVerification() == CategoryVerification.VERIFIED) {
            u.setCategoryVerification(CategoryVerification.PENDING);   // selo volta para conferência
        }
        return view(users.save(u));
    }

    /**
     * Foto de perfil (OS-18): a chave vem do {@code POST /api/v1/media/uploads}; a foto é recortada em quadrado, fica
     * com 512 px e sai sem EXIF/GPS. A foto anterior sai do bucket depois do commit.
     */
    @Transactional
    public ProfileView setPhoto(long userId, String uploadKey) {
        UserControlList u = users.findById(userId).orElseThrow();
        String publicKey;
        try {
            publicKey = media.claimImage(userId, uploadKey == null ? null : uploadKey.strip(), ImageSanitizer.Fit.AVATAR);
        } catch (MediaExceptions.Invalid e) {
            throw new AccountExceptions.Invalid(e.errors());
        }
        media.discardAfterCommit(u.getPhotoObjectKey());
        u.setPhotoObjectKey(publicKey);
        return view(users.save(u));
    }

    /** Sem foto: o app mostra as iniciais. O objeto sai do bucket depois do commit. */
    @Transactional
    public ProfileView removePhoto(long userId) {
        UserControlList u = users.findById(userId).orElseThrow();
        media.discardAfterCommit(u.getPhotoObjectKey());
        u.setPhotoObjectKey(null);
        return view(users.save(u));
    }

    ProfileView view(UserControlList u) {
        return new ProfileView(u.getId(), u.getName(), u.getHandle(), u.getEmail(), u.getRecoveryEmail(),
                u.getCellphoneNumber(), u.getUserDateOfBirth(), u.getGender(), u.getBio(), u.getPronouns(),
                u.getLinks(), u.getCountryOfResidence(), u.getStateOfResidence(), u.getCityOfResidence(),
                CategoryView.of(u.getUserType()), u.getCategoryVerification(), u.getTypeDetails(), u.getPhotoObjectKey(),
                links.mediaUrl(u.getPhotoObjectKey()));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
