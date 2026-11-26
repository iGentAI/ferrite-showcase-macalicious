#!/usr/bin/env python3
"""Tests of build.py's token conversion: which side of a tokens-core.txt row is converted from
the captures' colour space to sRGB.

  python3 -m unittest discover -s reference/spec/tools -p "test_*.py"

No reference screenshot is read. The real converter needs a capture's colour profile; these
tests pass a stand-in that marks what it was given, so that a converted value differs from the
value as written whatever the colour (a documented #ffff00 converts to #ffff00, which hides a
mistake).
"""
import unittest

import build


def marked(value):
    """Stand-in for the Display P3 to sRGB converter: marks a value as converted."""
    return "converted(%s)" % value


class TokenSrgb(unittest.TestCase):
    def test_measured_rows_convert_both_appearances(self):
        for tag in ("[M]", "[C]", "[I]", ""):
            with self.subTest(tag=tag):
                self.assertEqual(
                    build.token_srgb("#4188f2", "#549bf8", tag, marked),
                    ("converted(#4188f2)", "converted(#549bf8)"),
                )

    def test_documented_rows_convert_neither_appearance(self):
        self.assertEqual(
            build.token_srgb("#0068da", "#419cff", "[D]", marked), ("#0068da", "#419cff")
        )

    def test_documented_light_measured_dark_converts_only_the_dark_value(self):
        self.assertEqual(
            build.token_srgb("#ffff00", "#b9d553", "[D] light, [M] dark", marked),
            ("#ffff00", "converted(#b9d553)"),
        )

    def test_measured_light_documented_dark_converts_only_the_light_value(self):
        self.assertEqual(
            build.token_srgb("#4188f2", "#419cff", "[M] light, [D] dark", marked),
            ("converted(#4188f2)", "#419cff"),
        )

    def test_a_documented_side_is_kept_as_written_not_reformatted(self):
        light, dark = build.token_srgb("rgb(0 0 0 / 0.85)", "#ABCDEF", "[D]", marked)
        self.assertEqual((light, dark), ("rgb(0 0 0 / 0.85)", "#ABCDEF"))


if __name__ == "__main__":
    unittest.main()
