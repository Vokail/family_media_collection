Feature: Load More auto-advance for Lego search (#116)
  As an editor adding a Lego set to my collection
  I want the Load More button to vanish when there are no more *unique* sets
  So that I never press it twice just to confirm there's nothing left

  Background:
    Given I am authenticated as an editor
    And I am on the Lego add page

  Scenario: Auto-advance through an all-dupe page to the next page with new items
    Given the search results respond with:
      | offset | sets             | hasMore |
      | 0      | 75192-1, 75257-1 | true    |
      | 20     | 75192-1, 75257-1 | true    |
      | 40     | 75375-1          | false   |
    When I search for "Falcon"
    And I press the Load More button
    Then I see 3 search result items
    And the Load More button is hidden

  Scenario: Stop and hide the button when every page is dupes and the API never reports the end
    Given the search results respond with all-dupe pages forever:
      | sets             |
      | 75192-1, 75257-1 |
    When I search for "Falcon"
    And I press the Load More button
    Then the Load More button is hidden
