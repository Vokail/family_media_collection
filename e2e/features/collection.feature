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

  # ── Long-name header alignment (#147) ───────────────────────────────────────
  #
  # With a long member name the page header is a flex row:
  #   [← Members]  [name — flex-1]  [Stats]  [👤?]
  #
  # Without min-w-0 on the h1, its intrinsic text width overrides flex-shrink
  # and can push the back button off-screen or force the row to wrap.
  # Fix: add min-w-0 and truncate to the h1.

  Scenario: Back button and Stats link stay visible with a long member name (#147)
    Given I am authenticated as an editor
    And I am on the collection page for a member with a very long name
    Then the "← Members" back button is visible in the header
    And the "Stats" link is visible in the header
    And neither is pushed off-screen by the member name

  Scenario: An overlong member name is truncated with an ellipsis (#147)
    Given I am authenticated as an editor
    And I am on the collection page for a member with a very long name
    Then the member name in the h1 is truncated with an ellipsis if it exceeds the available width
    And the header remains a single line
