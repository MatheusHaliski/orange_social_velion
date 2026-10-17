package com.orangesocial.domain.model;

/**
 * Item de {@code Listofcommunitiesofinterest}, escolhido no cadastro pela cadeia
 * typeofcommunity -> selectcountry -> selectcity.
 */
public record CommunityInterest(String typeOfCommunity, String country, String city) {

    public CommunityInterest {
        if (typeOfCommunity == null || typeOfCommunity.isBlank()) {
            throw new IllegalArgumentException("typeOfCommunity é obrigatório");
        }
        if (city != null && (country == null || country.isBlank())) {
            throw new IllegalArgumentException("country é obrigatório quando city é informada");
        }
    }
}
