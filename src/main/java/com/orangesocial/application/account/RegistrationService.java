package com.orangesocial.application.account;

import com.orangesocial.application.consent.ConsentService;
import com.orangesocial.domain.model.TermsAcceptance;
import com.orangesocial.domain.model.UserCategoryEnum;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.domain.model.UserPreference;
import com.orangesocial.infrastructure.persistence.postgres.TermsAcceptanceRepository;
import com.orangesocial.infrastructure.persistence.postgres.UserControlListRepository;
import com.orangesocial.infrastructure.persistence.postgres.UserPreferenceRepository;
import com.orangesocial.security.ClientInfo;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Cadastro (RF1): dados mínimos + tipo de usuário escolhido + aceite dos Termos de Uso da Velion.
 * Na mesma transação: usuário (PENDING_VERIFICATION), aceite dos termos, consentimentos opcionais todos
 * desligados (Privacy by Default, RF3) e preferências padrão (protetivas para menor de 16).
 */
@Service
public class RegistrationService {

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]{1,64}@[^@\\s]+\\.[^@\\s]{2,}$");
    private static final Pattern HANDLE = Pattern.compile("^[a-z0-9._]{3,30}$");

    private final UserControlListRepository users;
    private final TermsAcceptanceRepository terms;
    private final UserPreferenceRepository preferences;
    private final PasswordEncoder passwords;
    private final LegalDocuments legal;
    private final AgePolicy age;
    private final EmailVerificationService verification;
    private final ConsentService consents;

    public RegistrationService(UserControlListRepository users, TermsAcceptanceRepository terms,
                               UserPreferenceRepository preferences, PasswordEncoder passwords, LegalDocuments legal,
                               AgePolicy age, EmailVerificationService verification, ConsentService consents) {
        this.users = users;
        this.terms = terms;
        this.preferences = preferences;
        this.passwords = passwords;
        this.legal = legal;
        this.age = age;
        this.verification = verification;
        this.consents = consents;
    }

    public record Registration(String name, String handle, String email, String password, UserCategoryEnum userType,
                               LocalDate dateOfBirth, boolean acceptTerms, String termsVersion,
                               Map<String, Object> typeDetails) {
    }

    @Transactional
    public UserControlList register(Registration r, ClientInfo client) {
        String email = UserControlList.normalizeEmail(r.email());
        String handle = r.handle() == null ? null : r.handle().strip().toLowerCase(java.util.Locale.ROOT);
        List<String> errors = new ArrayList<>();
        if (!r.acceptTerms() || !legal.termsVersion().equals(r.termsVersion())) {
            errors.add("Para criar a conta, leia e aceite os Termos de Uso da Velion (versão " + legal.termsVersion() + ").");
        }
        if (r.name() == null || r.name().strip().length() < 2 || r.name().strip().length() > 120) {
            errors.add("Informe um nome de exibição com 2 a 120 caracteres.");
        }
        if (handle == null || !HANDLE.matcher(handle).matches()) {
            errors.add("O @usuário deve ter 3 a 30 caracteres: letras minúsculas, números, ponto ou sublinhado.");
        }
        if (email == null || !EMAIL.matcher(email).matches()) {
            errors.add("Informe um e-mail válido.");
        }
        if (r.userType() == null) {
            errors.add("Escolha o tipo de usuário.");
        }
        if (r.dateOfBirth() == null || r.dateOfBirth().isAfter(LocalDate.now())) {
            errors.add("Informe sua data de nascimento.");
        } else if (age.tooYoung(r.dateOfBirth())) {
            errors.add("O Orange Social é para maiores de " + age.minimumAge() + " anos.");
        } else if (r.userType() != null && r.userType() != UserCategoryEnum.VERDE && !age.adult(r.dateOfBirth())) {
            errors.add("Contas de " + r.userType().getLabel() + " precisam de um responsável maior de 18 anos.");
        }
        errors.addAll(PasswordPolicy.problems(r.password(), email, handle));
        if (!errors.isEmpty()) {
            throw new AccountExceptions.Invalid(errors);
        }

        Map<String, Object> details = UserTypeDetailsValidator.validate(r.userType(), r.typeDetails());
        boolean minor = age.protectedMinor(r.dateOfBirth());
        if (minor && !details.containsKey("guardianEmail")) {
            throw new AccountExceptions.Invalid(
                    "Menores de 16 anos precisam informar o e-mail de um responsável (ECA Digital).");
        }
        if (users.existsByEmail(email)) {
            throw new AccountExceptions.Conflict("Não foi possível usar este e-mail. Se ele já é seu, entre ou recupere a senha.");
        }
        if (users.existsByHandle(handle)) {
            throw new AccountExceptions.Conflict("Esse @usuário já está em uso. Tente outro.");
        }

        UserControlList user = new UserControlList(r.name().strip(), email, passwords.encode(r.password()), r.userType());
        user.setHandle(handle);
        user.setUserDateOfBirth(r.dateOfBirth());
        user.setTypeDetails(details);
        user.setCategoryVerification(UserTypeDetailsValidator.initialVerification(r.userType(), details));
        if (details.get("city") != null) {
            user.setCityOfResidence(details.get("city").toString());
        }
        user = users.saveAndFlush(user);

        terms.save(new TermsAcceptance(user.getId(), TermsAcceptance.TERMS_OF_USE, legal.termsVersion(),
                client.channel(), client.ipHash()));
        consents.recordDefaults(user.getId(), client);   // as 6 finalidades de ConsentPurpose, desligadas
        preferences.save(UserPreference.defaultsFor(user.getId(), minor));
        verification.issue(user);
        return user;
    }
}
