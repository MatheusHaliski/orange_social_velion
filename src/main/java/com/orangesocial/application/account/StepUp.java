package com.orangesocial.application.account;

import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.infrastructure.persistence.postgres.UserControlListRepository;
import com.orangesocial.security.LoginThrottle;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Modo sudo (OWASP/NIST): ações sensíveis — trocar senha, mexer no 2FA, excluir a conta — pedem a senha de novo
 * e, com 2FA ativo, um código. Erros contam no mesmo limite de tentativas do login.
 */
@Component
public class StepUp {

    private final UserControlListRepository users;
    private final PasswordEncoder passwords;
    private final MfaService mfa;
    private final LoginThrottle throttle;

    public StepUp(UserControlListRepository users, PasswordEncoder passwords, MfaService mfa, LoginThrottle throttle) {
        this.users = users;
        this.passwords = passwords;
        this.mfa = mfa;
        this.throttle = throttle;
    }

    public UserControlList confirm(long userId, String password, String code, String ipHash) {
        String account = "sudo:" + userId;
        throttle.beforeAttempt(account, ipHash);
        UserControlList user = users.findById(userId).orElseThrow();
        boolean ok = password != null && passwords.matches(password, user.getPasswordHash())
                && (!mfa.isEnabled(userId) || mfa.verify(userId, code));
        if (!ok) {
            throttle.onFailure(account);
            throw new AccountExceptions.Forbidden(mfa.isEnabled(userId)
                    ? "Senha ou código do app autenticador incorretos."
                    : "Senha incorreta.");
        }
        throttle.onSuccess(account);
        return user;
    }
}
