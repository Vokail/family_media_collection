Feature: Members page
  Once authenticated, the user picks which family member's collection to browse.

  Scenario: The members page lists every family member
    Given I am authenticated as an editor
    When I visit the members page
    Then I see the member "Alice"
    And I see the member "Bob"
    And I see the member "Charlie"
    And I see the member "Dana"

  # ── Single-collection layout (#146) ─────────────────────────────────────────
  #
  # When a member has only one collection enabled, the collection badge row was
  # left-aligned (flex default), leaving lopsided whitespace on the right side
  # of the card and making it look broken compared to full-collection cards.
  # Fix: add justify-center to the badge row flex container.

  Scenario: Member card with a single active collection is centred, not lopsided (#146)
    Given I am authenticated as an editor
    And Alice has only her vinyl collection enabled
    When I visit the members page
    Then Alice's card shows only the vinyl collection badge
    And the badge row is horizontally centred within the card

  Scenario: Member card with two active collections shows only those two (#146)
    Given I am authenticated as an editor
    And Alice has only her vinyl and book collections enabled
    When I visit the members page
    Then Alice's card shows the vinyl and book badges
    And no comic or lego badge is visible on Alice's card

  Scenario: Member card with all four collections still displays correctly
    Given I am authenticated as an editor
    And Alice has all four collections enabled
    When I visit the members page
    Then Alice's card shows vinyl, book, comic, and lego badges

  # ── Equal-height cards (#148) ────────────────────────────────────────────────
  #
  # On a narrow 2-column grid (mobile), a member with 4 collections had taller
  # cards than a member with 1 collection because:
  #   (a) the 4 badges wrapped to a 2nd row on narrow screens, and
  #   (b) without whitespace-nowrap, "🎵 5" split to "🎵 / 5" within each span.
  # Fix: flex-wrap on the container, whitespace-nowrap on spans, min-h-10 to
  # equalise the badge area height across all cards.

  Scenario: All member cards on the overview page are the same height (#148)
    Given I am authenticated as an editor
    And Alice has only her vinyl collection enabled
    And Bob has all four collections enabled
    When I visit the members page on a 375px viewport
    Then Alice's card and Bob's card are the same height

  Scenario: Collection count badge stays on one line even on a narrow screen (#148)
    Given I am authenticated as an editor
    And Bob has all four collections enabled
    When I visit the members page on a 375px viewport
    Then each collection badge (icon + count) is displayed on a single line

  Scenario: Cards with 4 collections look consistent with cards with 1 collection (#148)
    Given I am authenticated as an editor
    And Alice has only her vinyl collection enabled
    And Bob has all four collections enabled
    When I visit the members page
    Then both cards have the same badge-row height
    And neither card looks lopsided or broken
