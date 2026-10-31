package com.orangesocial.domain.model;

import java.time.Instant;

/**
 * Valor do campo {@code LastSavedLocation}, persistido como JSON
 * {@code {"lat": ..., "lng": ..., "timestamp": "..."}}.
 */
public record GeoLocation(double lat, double lng, Instant timestamp) {

    public GeoLocation {
        // forma positiva: toda comparação com NaN é falsa, e "lat < -90 || lat > 90" deixava NaN passar
        if (!(lat >= -90 && lat <= 90)) {
            throw new IllegalArgumentException("Latitude fora do intervalo: " + lat);
        }
        if (!(lng >= -180 && lng <= 180)) {
            throw new IllegalArgumentException("Longitude fora do intervalo: " + lng);
        }
        if (timestamp == null) {
            throw new IllegalArgumentException("timestamp é obrigatório");
        }
    }
}
