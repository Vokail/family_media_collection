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
