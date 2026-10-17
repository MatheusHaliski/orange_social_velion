package com.orangesocial.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Entidade principal de usuário, mapeada para a tabela {@code VSusercontrolist}
 * (PostgreSQL; ver src/main/resources/schema.sql para o de/para dos 19 campos).
 */
@Entity
@Table(name = "\"VSusercontrolist\"")  // nome citado: o DDL preserva maiúsculas
public class UserControlList {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    // 1 · Name
    @NotBlank
    @Size(max = 120)
    @Column(name = "name", nullable = false, length = 120)
    private String name;

    // 2 · Password (somente hash)
    @NotBlank
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    // 3 · Email
    @NotBlank
    @Email
    @Column(name = "email", nullable = false, unique = true, length = 254)
    private String email;

    // 4 · Recoveryemail
    @Email
    @Column(name = "recovery_email", length = 254)
    private String recoveryEmail;

    // 5 · Cityzenship
    @Size(min = 2, max = 2)
    @Column(name = "citizenship", length = 2)
    private String citizenship;

    // 6 · Country of residence
    @Size(min = 2, max = 2)
    @Column(name = "country_of_residence", length = 2)
    private String countryOfResidence;

    // 7 · State of residence
    @Column(name = "state_of_residence", length = 80)
    private String stateOfResidence;

    // 8 · City of residence
    @Column(name = "city_of_residence", length = 120)
    private String cityOfResidence;

    // 9 · Address
    @Column(name = "address")
    private String address;

    // 10 · Cellphonenumber (E.164)
    @Pattern(regexp = "^\\+[1-9]\\d{7,14}$")
    @Column(name = "cellphone_number", length = 20)
    private String cellphoneNumber;

    // 11 · Listofinterestandhobbies
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "list_of_interests_and_hobbies")
    private List<String> listOfInterestsAndHobbies = new ArrayList<>();

    // 12 · Listofjobsinterests
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "list_of_jobs_interests")
    private List<String> listOfJobsInterests = new ArrayList<>();

    // 13 · Userdb (data de nascimento)
    @Past
    @Column(name = "user_date_of_birth")
    private LocalDate userDateOfBirth;

    // 14 · Gender
    @Column(name = "gender", length = 40)
    private String gender;

    // 15 · sexualpreference — dado sensível (LGPD Art. 11), só com consentimento
    @Column(name = "sexual_preference", length = 40)
    private String sexualPreference;

    // 16 · Photo — chave do objeto no S3, nunca o binário
    @Column(name = "photo_object_key", length = 512)
    private String photoObjectKey;

    // 17 · Usertype
    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "user_type", nullable = false)
    private UserCategoryEnum userType = UserCategoryEnum.VERDE;

    // 18 · Listofcommunitiesofinterest
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "list_of_communities_of_interest")
    private List<CommunityInterest> listOfCommunitiesOfInterest = new ArrayList<>();

    // 19 · LastSavedLocation
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "last_saved_location")
    private GeoLocation lastSavedLocation;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "account_status", nullable = false)
    private AccountStatus accountStatus = AccountStatus.PENDING_VERIFICATION;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;

    // ---------------------------------------------------------------- perfil comum (docs/PESQUISA_DADOS_USUARIO.md §2)

    /** @usuário público: minúsculas, dígitos, ponto e sublinhado; 3 a 30 caracteres. */
    @Pattern(regexp = "^[a-z0-9._]{3,30}$")
    @Column(name = "handle", length = 30)
    private String handle;

    @Size(max = 150)
    @Column(name = "bio", length = 150)
    private String bio;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "pronouns")
    private List<String> pronouns = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "links")
    private List<String> links = new ArrayList<>();

    /** Campos específicos da categoria (§3), validados por {@code UserTypeDetailsValidator}. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "type_details")
    private java.util.Map<String, Object> typeDetails = new java.util.LinkedHashMap<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "category_verification", nullable = false)
    private CategoryVerification categoryVerification = CategoryVerification.NOT_REQUIRED;

    /** Exclusão com carência (RF23): pedido, fim do prazo e status para o qual a conta volta se reativada. */
    @Column(name = "deletion_requested_at")
    private Instant deletionRequestedAt;

    @Column(name = "deletion_scheduled_for")
    private Instant deletionScheduledFor;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_before_deletion")
    private AccountStatus statusBeforeDeletion;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    protected UserControlList() {
        // JPA
    }

    public UserControlList(String name, String email, String passwordHash, UserCategoryEnum userType) {
        this.name = name;
        this.email = normalizeEmail(email);
        this.passwordHash = passwordHash;
        this.userType = userType;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // ---------------------------------------------------------------- ciclo de vida

    public void activate() {
        transitionTo(AccountStatus.ACTIVE);
    }

    public void suspend() {
        transitionTo(AccountStatus.SUSPENDED);
    }

    /** Código de e-mail confirmado (RF1): conta pendente vira ativa; trocar e-mail depois só registra a data. */
    public void markEmailVerified(Instant when) {
        this.emailVerifiedAt = when;
        if (accountStatus == AccountStatus.PENDING_VERIFICATION) {
            transitionTo(AccountStatus.ACTIVE);
        }
    }

    /**
     * "Excluir conta" confirmado (RF23): a conta some do app na hora e fica {@code grace} esperando.
     * Entrar de novo dentro do prazo permite {@link #reactivate(Instant)}; depois dele, a saga elimina.
     */
    public Instant requestDeletion(Instant now, Duration grace) {
        AccountStatus previous = accountStatus;
        transitionTo(AccountStatus.PENDING_DELETION);
        this.statusBeforeDeletion = previous;
        this.deletionRequestedAt = now;
        this.deletionScheduledFor = now.plus(grace);
        return deletionScheduledFor;
    }

    public boolean canReactivate(Instant now) {
        return accountStatus == AccountStatus.PENDING_DELETION && now.isBefore(deletionScheduledFor);
    }

    /** Desfaz o pedido de exclusão dentro do prazo, devolvendo o status anterior (ativa, pendente ou suspensa). */
    public void reactivate(Instant now) {
        if (!canReactivate(now)) {
            throw new IllegalStateException("O prazo para reativar esta conta terminou.");
        }
        transitionTo(statusBeforeDeletion == null ? AccountStatus.ACTIVE : statusBeforeDeletion);
        this.statusBeforeDeletion = null;
        this.deletionRequestedAt = null;
        this.deletionScheduledFor = null;
    }

    public static String normalizeEmail(String email) {
        return email == null ? null : email.strip().toLowerCase(java.util.Locale.ROOT);
    }

    /**
     * Eliminação a pedido do titular (LGPD Art. 18, VI). Mantém apenas o id para
     * integridade referencial; todos os dados pessoais são removidos ou substituídos.
     * A remoção da foto no S3 e da timeline no Cassandra é feita pelo serviço de aplicação.
     */
    public void anonymizeForLgpdDeletion(String anonymizedPasswordHash) {
        transitionTo(AccountStatus.ANONYMOUS_LGPD_DELETED);
        this.name = "Usuário removido";
        this.email = "deleted+" + id + "@anon.orangesocial.invalid";
        this.passwordHash = anonymizedPasswordHash;
        this.recoveryEmail = null;
        this.citizenship = null;
        this.countryOfResidence = null;
        this.stateOfResidence = null;
        this.cityOfResidence = null;
        this.address = null;
        this.cellphoneNumber = null;
        this.listOfInterestsAndHobbies = new ArrayList<>();
        this.listOfJobsInterests = new ArrayList<>();
        this.userDateOfBirth = null;
        this.gender = null;
        this.sexualPreference = null;
        this.photoObjectKey = null;
        this.handle = null;
        this.bio = null;
        this.pronouns = new ArrayList<>();
        this.links = new ArrayList<>();
        this.typeDetails = new java.util.LinkedHashMap<>();
        this.listOfCommunitiesOfInterest = new ArrayList<>();
        this.lastSavedLocation = null;
        this.deletedAt = Instant.now();
    }

    private void transitionTo(AccountStatus target) {
        if (!accountStatus.canTransitionTo(target)) {
            throw new IllegalStateException("Transição inválida: " + accountStatus + " -> " + target);
        }
        this.accountStatus = target;
    }

    // ---------------------------------------------------------------- getters / setters

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = normalizeEmail(email);
    }

    public String getRecoveryEmail() {
        return recoveryEmail;
    }

    public void setRecoveryEmail(String recoveryEmail) {
        this.recoveryEmail = recoveryEmail;
    }

    public String getCitizenship() {
        return citizenship;
    }

    public void setCitizenship(String citizenship) {
        this.citizenship = citizenship;
    }

    public String getCountryOfResidence() {
        return countryOfResidence;
    }

    public void setCountryOfResidence(String countryOfResidence) {
        this.countryOfResidence = countryOfResidence;
    }

    public String getStateOfResidence() {
        return stateOfResidence;
    }

    public void setStateOfResidence(String stateOfResidence) {
        this.stateOfResidence = stateOfResidence;
    }

    public String getCityOfResidence() {
        return cityOfResidence;
    }

    public void setCityOfResidence(String cityOfResidence) {
        this.cityOfResidence = cityOfResidence;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getCellphoneNumber() {
        return cellphoneNumber;
    }

    public void setCellphoneNumber(String cellphoneNumber) {
        this.cellphoneNumber = cellphoneNumber;
    }

    public List<String> getListOfInterestsAndHobbies() {
        return listOfInterestsAndHobbies;
    }

    public void setListOfInterestsAndHobbies(List<String> listOfInterestsAndHobbies) {
        this.listOfInterestsAndHobbies = listOfInterestsAndHobbies;
    }

    public List<String> getListOfJobsInterests() {
        return listOfJobsInterests;
    }

    public void setListOfJobsInterests(List<String> listOfJobsInterests) {
        this.listOfJobsInterests = listOfJobsInterests;
    }

    public LocalDate getUserDateOfBirth() {
        return userDateOfBirth;
    }

    public void setUserDateOfBirth(LocalDate userDateOfBirth) {
        this.userDateOfBirth = userDateOfBirth;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getSexualPreference() {
        return sexualPreference;
    }

    public void setSexualPreference(String sexualPreference) {
        this.sexualPreference = sexualPreference;
    }

    public String getPhotoObjectKey() {
        return photoObjectKey;
    }

    public void setPhotoObjectKey(String photoObjectKey) {
        this.photoObjectKey = photoObjectKey;
    }

    public UserCategoryEnum getUserType() {
        return userType;
    }

    public void setUserType(UserCategoryEnum userType) {
        this.userType = userType;
    }

    public List<CommunityInterest> getListOfCommunitiesOfInterest() {
        return listOfCommunitiesOfInterest;
    }

    public void setListOfCommunitiesOfInterest(List<CommunityInterest> listOfCommunitiesOfInterest) {
        this.listOfCommunitiesOfInterest = listOfCommunitiesOfInterest;
    }

    public GeoLocation getLastSavedLocation() {
        return lastSavedLocation;
    }

    public void setLastSavedLocation(GeoLocation lastSavedLocation) {
        this.lastSavedLocation = lastSavedLocation;
    }

    public AccountStatus getAccountStatus() {
        return accountStatus;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public String getHandle() {
        return handle;
    }

    public void setHandle(String handle) {
        this.handle = handle == null ? null : handle.strip().toLowerCase(java.util.Locale.ROOT);
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }

    public List<String> getPronouns() {
        return pronouns;
    }

    public void setPronouns(List<String> pronouns) {
        this.pronouns = pronouns == null ? new ArrayList<>() : new ArrayList<>(pronouns);
    }

    public List<String> getLinks() {
        return links;
    }

    public void setLinks(List<String> links) {
        this.links = links == null ? new ArrayList<>() : new ArrayList<>(links);
    }

    public java.util.Map<String, Object> getTypeDetails() {
        return typeDetails;
    }

    public void setTypeDetails(java.util.Map<String, Object> typeDetails) {
        this.typeDetails = typeDetails == null ? new java.util.LinkedHashMap<>() : new java.util.LinkedHashMap<>(typeDetails);
    }

    public CategoryVerification getCategoryVerification() {
        return categoryVerification;
    }

    public void setCategoryVerification(CategoryVerification categoryVerification) {
        this.categoryVerification = categoryVerification;
    }

    public Instant getEmailVerifiedAt() {
        return emailVerifiedAt;
    }

    public Instant getDeletionRequestedAt() {
        return deletionRequestedAt;
    }

    public Instant getDeletionScheduledFor() {
        return deletionScheduledFor;
    }

    public AccountStatus getStatusBeforeDeletion() {
        return statusBeforeDeletion;
    }

    public Long getVersion() {
        return version;
    }
}
