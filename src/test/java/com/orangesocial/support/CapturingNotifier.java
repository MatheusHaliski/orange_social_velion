package com.orangesocial.support;

import com.orangesocial.application.account.AccountNotifier;
import com.orangesocial.domain.model.UserControlList;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/** Guarda os avisos que iriam por e-mail, para os testes lerem o código de verificação e os alertas. */
@TestConfiguration(proxyBeanMethods = false)
public class CapturingNotifier {

    @Bean
    @Primary
    Captured capturedNotifier() {
        return new Captured();
    }

    public static class Captured implements AccountNotifier {
        public final Map<String, String> codes = new ConcurrentHashMap<>();
        public final List<String> events = new CopyOnWriteArrayList<>();

        @Override
        public void verificationCode(UserControlList user, String code) {
            codes.put(user.getEmail(), code);
        }

        @Override
        public void loginAlert(UserControlList user, String device) {
            events.add("login:" + user.getEmail());
        }

        @Override
        public void passwordChanged(UserControlList user) {
            events.add("password:" + user.getEmail());
        }

        @Override
        public void mfaChanged(UserControlList user, boolean enabled) {
            events.add("mfa-" + enabled + ":" + user.getEmail());
        }

        @Override
        public void deletionScheduled(UserControlList user, Instant deletionAt) {
            events.add("deletion:" + user.getEmail());
        }

        @Override
        public void accountReactivated(UserControlList user) {
            events.add("reactivated:" + user.getEmail());
        }
    }
}
