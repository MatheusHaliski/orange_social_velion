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

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Entidade principal de usuário, mapeada para a tabela {@code VSusercontrolist}
 * (PostgreSQL; ver src/main/resources/schema.sql para o de/para dos 19 campos).
 */
@Entity
@Table(name = "VSusercontrolist")
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

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    protected UserControlList() {
        // JPA
    }

    public UserControlList(String name, String email, String passwordHash, UserCategoryEnum userType) {
        this.name = name;
        this.email = email;
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
        this.email = email;
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

    public Long getVersion() {
        return version;
    }
}
