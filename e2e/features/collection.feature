Feature: Collection page UI regressions
  Layout/interaction bugs we never want back.

  Scenario Outline: The toolbar fits inside the viewport for every collection type (#118, #119)
    # #119 specifically observed wrap on books/comics/lego on iPhone 12 mini —
    # exercise all four collection types, not just vinyl.
    Given I am authenticated as an editor
    And I am on Alice's <collection> collection page
    Then the sort dropdown is visible inside the viewport
    And the view-mode toggle is visible inside the viewport

    Examples:
      | collection |
      | vinyl      |
      | book       |
      | comic      |
      | lego       |

  Scenario: With the widest sort option selected, the toolbar still fits (#119)
    # On books/comics, "Read / Unread" is the widest dropdown option. On real
    # iOS Safari (15+) selects can expand on certain renders. Verify the row
    # still fits with that label rendered as the selected value.
    Given I am authenticated as an editor
    And I am on Alice's book collection page
    When I sort by status
    Then the sort dropdown is visible inside the viewport
    And the view-mode toggle is visible inside the viewport

  Scenario: Clicking a sidebar letter triggers a smooth scroll after sort change (#117)
    Given I am authenticated as an editor
    And I am on Alice's vinyl collection page
    When I sort by title
    And I click the first sidebar letter
    Then the page scrolls to a section
