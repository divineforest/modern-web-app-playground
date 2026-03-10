# Cycle Refactor

Iteratively improve the specified code (user will @mention files/folders, or use recent conversation context).

## Per Cycle (max 5 cycles)

1. **Score**: Rate 0.0-10.0 (actual quality: readability, correctness, maintainability)
2. **Top Issue**: Identify the single highest-impact problem (be specific: line numbers, function names)
3. **Fix**: Implement the improvement
4. **New Score**: Re-rate after fix

## Stop When
- Score reaches 9.0+
- No issue worth fixing (score gain < 0.5)
- 5 cycles completed

## Rules
- One issue per cycle, implement immediately, then reassess
- Be specific: "function X is 80 lines" not "code could be cleaner"
- Skip theoretical improvements - only fix real problems you can point to
- If starting score is 9.0+ or nothing concrete to fix, say so and stop