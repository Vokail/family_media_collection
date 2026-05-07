Feature: Collection page UI regressions
  Two layout/interaction bugs we never want back.

  Background:
    Given I am authenticated as an editor
    And I am on Alice's vinyl collection page

  Scenario: The toolbar fits inside the viewport (#118)
    Then the sort dropdown is visible inside the viewport
    And the view-mode toggle is visible inside the viewport

  Scenario: Clicking a sidebar letter triggers a smooth scroll after sort change (#117)
    When I sort by title
    And I click the first sidebar letter
    Then the page scrolls to a section
