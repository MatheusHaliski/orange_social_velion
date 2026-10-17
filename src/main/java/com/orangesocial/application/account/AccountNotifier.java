package com.orangesocial.application.account;

import com.orangesocial.domain.model.UserControlList;

import java.time.Instant;

/**
 * Avisos ao titular por e-mail (fora de banda): código de verificação e mudanças de segurança. A implementação
 * de produção (provedor de e-mail transacional) entra com o OS-12; até lá {@link LoggingAccountNotifier}.
 */
public interface AccountNotifier {

    void verificationCode(UserControlList user, String code);

    void loginAlert(UserControlList user, String device);

    void passwordChanged(UserControlList user);

    void mfaChanged(UserControlList user, boolean enabled);

    void deletionScheduled(UserControlList user, Instant deletionAt);

    void accountReactivated(UserControlList user);
}
