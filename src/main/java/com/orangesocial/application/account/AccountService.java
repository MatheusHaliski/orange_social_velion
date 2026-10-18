package com.orangesocial.application.account;

import com.orangesocial.application.account.AccountViews.DeletionView;
import com.orangesocial.application.media.MediaJanitor;
import com.orangesocial.application.post.PostContentEraser;
import com.orangesocial.domain.model.AccountStatus;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.infrastructure.persistence.postgres.RecoveryCodeRepository;
import com.orangesocial.infrastructure.persistence.postgres.UserControlListRepository;
import com.orangesocial.infrastructure.persistence.postgres.UserMfaRepository;
import com.orangesocial.infrastructure.persistence.postgres.UserPreferenceRepository;
import com.orangesocial.security.SessionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Segurança da conta: trocar senha e excluir conta com 30 dias para reativar (RF23).
 * Ambas encerram as outras sessões; a exclusão encerra todas, inclusive a atual.
 */
@Service
public class AccountService {

    private static final Logger log = LoggerFactory.getLogger(AccountService.class);

    private final UserControlListRepository users;
    private final UserMfaRepository mfa;
    private final RecoveryCodeRepository recovery;
    private final UserPreferenceRepository preferences;
    private final PasswordEncoder passwords;
    private final SessionService sessions;
    private final PostContentEraser eraser;
    private final MediaJanitor media;
    private final AccountNotifier notifier;
    private final Clock clock;
    private final Duration grace;

    public AccountService(UserControlListRepository users, UserMfaRepository mfa, RecoveryCodeRepository recovery,
                          UserPreferenceRepository preferences, PasswordEncoder passwords, SessionService sessions,
                          PostContentEraser eraser, MediaJanitor media, AccountNotifier notifier, Clock clock,
                          @Value("${orange-social.account.deletion-grace:30d}") Duration grace) {
        this.users = users;
        this.mfa = mfa;
        this.recovery = recovery;
        this.preferences = preferences;
        this.passwords = passwords;
        this.sessions = sessions;
        this.eraser = eraser;
        this.media = media;
        this.notifier = notifier;
        this.clock = clock;
        this.grace = grace;
    }

    /** Senha nova (já com o modo sudo confirmado): sai de todos os outros aparelhos. */
    @Transactional
    public int changePassword(UserControlList user, String newPassword, String currentSessionId) {
        List<String> problems = PasswordPolicy.problems(newPassword, user.getEmail(), user.getHandle());
        if (!problems.isEmpty()) {
            throw new AccountExceptions.Invalid(problems);
        }
        if (passwords.matches(newPassword, user.getPasswordHash())) {
            throw new AccountExceptions.Invalid("A nova senha precisa ser diferente da atual.");
        }
        user.setPasswordHash(passwords.encode(newPassword));
        users.save(user);
        notifier.passwordChanged(user);
        return sessions.revokeAll(user.getId(), currentSessionId);
    }

    /**
     * "Excluir conta" confirmado no modal (senha + 2FA já conferidos): a conta some na hora, todas as sessões
     * caem e o titular tem {@code grace} (30 dias) para entrar de novo e reativar.
     */
    @Transactional
    public DeletionView requestDeletion(UserControlList user) {
        Instant when = user.requestDeletion(clock.instant(), grace);
        users.save(user);
        sessions.revokeAll(user.getId(), null);
        notifier.deletionScheduled(user, when);
        return new DeletionView(user.getAccountStatus(), when, (int) grace.toDays());
    }

    /** Contas cujo prazo de reativação venceu (o job chama {@link #eliminate(long)} uma a uma). */
    @Transactional(readOnly = true)
    public List<Long> dueForElimination() {
        return users.findByAccountStatusAndDeletionScheduledForBefore(AccountStatus.PENDING_DELETION, clock.instant())
                .stream().map(UserControlList::getId).toList();
    }

    @Transactional
    public void eliminate(long userId) {
        UserControlList user = users.findById(userId).orElseThrow();
        if (user.getAccountStatus() != AccountStatus.PENDING_DELETION || user.canReactivate(clock.instant())) {
            return;
        }
        PostContentEraser.ErasureReport report = eraser.eraseContentOf(userId);
        mfa.deleteById(userId);
        recovery.deleteAllOf(userId);
        preferences.deleteById(userId);
        user.anonymizeForLgpdDeletion(passwords.encode(UUID.randomUUID().toString()));
        users.save(user);
        sessions.revokeAll(userId, null);
        // fotos dos posts saem do bucket só depois do commit (o banco já não aponta para elas)
        media.deleteAfterCommit(report.mediaKeysToDelete());
        // Próximos passos da saga (OS-44): timeline no Cassandra, DEK.
        log.info("Conta {} eliminada: {} posts, {} comentários, {} mídias para apagar",
                userId, report.postsRemoved(), report.commentsRemoved(), report.mediaKeysToDelete().size());
    }
}
