#!/usr/bin/env python3
"""Tests of corner_fit.py on synthetic corners whose radius is known.

  python3 -m unittest discover -s reference/spec/tools -p "test_*.py"

No reference screenshot is read: the whole-shape tests draw their own rounded rectangle with a
renderer written separately from corner_fit.render (signed distance to the full rectangle, 16x16
supersampling), save it as a PNG in a temporary folder and load it back through load_corner.
"""
import contextlib
import io
import math
import os
import tempfile
import unittest

import numpy as np
from PIL import Image

import corner_fit

BG = corner_fit.rgb("ececec")
FILL = corner_fit.rgb("ffffff")
TOP = corner_fit.rgb("c8c8c8")
SIDE = corner_fit.rgb("909090")
INNER = corner_fit.rgb("4080f0")


def best(results):
    rms, radius = min(results)
    return radius, rms


def draw_rounded_rect(width, height, box, radius, rings, fill, bg, ss=16):
    """A whole rounded rectangle. box = (left, top, right, bottom) in px, right and bottom
    exclusive. rings = [(width, colour on horizontal edges, colour on vertical edges)], outermost
    first; the two colours are blended by angle round each arc."""
    left, top, right, bottom = box
    c_x = (np.arange(width * ss) + 0.5) / ss
    c_y = (np.arange(height * ss) + 0.5) / ss
    px, py = np.meshgrid(c_x, c_y)
    # distance from the nearest vertical and horizontal edge, measured inwards
    dx = np.minimum(px - left, right - px)
    dy = np.minimum(py - top, bottom - py)
    in_arc = (dx < radius) & (dy < radius)
    depth = np.where(in_arc, radius - np.hypot(radius - dx, radius - dy), np.minimum(dx, dy))
    horizontal = np.where(
        in_arc,
        np.arctan2(np.maximum(radius - dy, 0), np.maximum(radius - dx, 1e-9)) / (math.pi / 2),
        (dy < dx).astype(float),
    )[..., None]
    out = np.empty(px.shape + (3,))
    out[:] = fill
    start = 0.0
    for ring_width, on_horizontal, on_vertical in rings:
        band = (depth >= start) & (depth < start + ring_width)
        out[band] = (horizontal * on_horizontal + (1 - horizontal) * on_vertical)[band]
        start += ring_width
    out[depth < 0] = bg
    return out.reshape(height, ss, width, ss, 3).mean(axis=(1, 3))


class RenderedCorner(unittest.TestCase):
    def test_recovers_the_radius_it_was_rendered_with(self):
        rings = [(1.0, TOP, SIDE)]
        for radius in (0.0, 5.25, 7.5, 9.0, 12.75):
            with self.subTest(radius=radius):
                target = corner_fit.render(16, radius, BG, rings, FILL)
                found, rms = best(corner_fit.fit(target, BG, rings, FILL, 0, 14, 0.25))
                self.assertEqual(found, radius)
                self.assertEqual(rms, 0.0)

    def test_error_grows_on_both_sides_of_the_true_radius(self):
        rings = [(1.0, TOP, SIDE)]
        target = corner_fit.render(16, 7.5, BG, rings, FILL)
        by_radius = {r: e for e, r in corner_fit.fit(target, BG, rings, FILL, 6.5, 8.5, 0.25)}
        self.assertLess(by_radius[7.25], by_radius[7.0])
        self.assertLess(by_radius[7.0], by_radius[6.5])
        self.assertLess(by_radius[7.75], by_radius[8.0])
        self.assertLess(by_radius[8.0], by_radius[8.5])
        self.assertGreater(by_radius[7.25], 0.5)
        self.assertGreater(by_radius[7.75], 0.5)

    def test_rings_of_unequal_width_are_laid_outermost_first(self):
        rings = [(1.0, TOP, SIDE), (3.0, INNER, INNER)]
        image = corner_fit.render(20, 6.0, BG, rings, FILL)
        m = corner_fit.MARGIN
        # a column well to the right of the arc: background, 1 px of TOP, 3 px of INNER, fill
        column = image[:, 18]
        np.testing.assert_allclose(column[m - 1], BG)
        np.testing.assert_allclose(column[m], TOP)
        for row in (m + 1, m + 2, m + 3):
            np.testing.assert_allclose(column[row], INNER)
        np.testing.assert_allclose(column[m + 4], FILL)
        # a row well below the arc: the first ring takes its vertical-edge colour there
        row = image[18]
        np.testing.assert_allclose(row[m - 1], BG)
        np.testing.assert_allclose(row[m], SIDE)
        np.testing.assert_allclose(row[m + 3], INNER)
        np.testing.assert_allclose(row[m + 4], FILL)

    def test_recovers_the_radius_with_rings_of_unequal_width(self):
        rings = [(1.0, TOP, SIDE), (3.0, INNER, INNER)]
        target = corner_fit.render(18, 9.5, BG, rings, FILL)
        found, rms = best(corner_fit.fit(target, BG, rings, FILL, 2, 14, 0.25))
        self.assertEqual((found, rms), (9.5, 0.0))
        # the same pixels read with the widths swapped must fit worse at every radius
        swapped = [(3.0, TOP, SIDE), (1.0, INNER, INNER)]
        self.assertGreater(best(corner_fit.fit(target, BG, swapped, FILL, 2, 14, 0.25))[1], 10)


class WholeShape(unittest.TestCase):
    """A rounded rectangle drawn by this file's own renderer, read back through load_corner."""

    BOX = (7, 9, 47, 39)  # left, top, right, bottom; right and bottom exclusive
    RADIUS = 7.5
    RINGS = [(1.0, TOP, SIDE), (2.0, INNER, INNER)]
    CORNERS = {"tl": (7, 9), "tr": (46, 9), "bl": (7, 38), "br": (46, 38)}

    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.TemporaryDirectory()
        image = draw_rounded_rect(56, 50, cls.BOX, cls.RADIUS, cls.RINGS, FILL, BG)
        cls.path = os.path.join(cls.folder.name, "shape.png")
        Image.fromarray(np.rint(image).astype(np.uint8), "RGB").save(cls.path)

    @classmethod
    def tearDownClass(cls):
        cls.folder.cleanup()

    def test_all_four_corners_give_the_drawn_radius(self):
        for corner, (x, y) in self.CORNERS.items():
            with self.subTest(corner=corner):
                target = corner_fit.load_corner(self.path, x, y, corner, 12)
                found, rms = best(corner_fit.fit(target, BG, self.RINGS, FILL, 2, 14, 0.25))
                self.assertEqual(found, self.RADIUS)
                self.assertLess(rms, 0.5)  # only the rounding to 8 bits is left

    def test_every_corner_is_turned_into_a_top_left_corner(self):
        loaded = {c: corner_fit.load_corner(self.path, x, y, c, 12) for c, (x, y) in self.CORNERS.items()}
        for corner in ("tr", "bl", "br"):
            with self.subTest(corner=corner):
                np.testing.assert_allclose(loaded[corner], loaded["tl"], atol=1)
        m = corner_fit.MARGIN
        np.testing.assert_allclose(loaded["br"][0, 0], BG)
        np.testing.assert_allclose(loaded["br"][m, 12], TOP, atol=1)
        np.testing.assert_allclose(loaded["br"][12, m], SIDE, atol=1)

    def test_a_corner_read_without_its_flip_does_not_fit(self):
        # the top-right corner read as if it were a top-left one: the shape is on the wrong side
        x, y = self.CORNERS["tr"]
        wrong = corner_fit.load_corner(self.path, x - 11, y, "tl", 12)
        self.assertGreater(best(corner_fit.fit(wrong, BG, self.RINGS, FILL, 2, 14, 0.25))[1], 20)

    def test_command_line_reports_the_radius_in_points(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            corner_fit.main(
                ["corner_fit.py", self.path, "46,38", "br", "--bg", "ececec", "--ring", "1:c8c8c8:909090"]
                + ["--ring", "2:4080f0", "--fill", "ffffff", "--size", "12"]
            )
        self.assertIn("best radius 7.50 px = 3.750 pt", out.getvalue())
        self.assertNotIn("WARNING", out.getvalue())

    def run_fit(self, *range_options):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            corner_fit.main(
                ["corner_fit.py", self.path, "7,9", "tl", "--bg", "ececec", "--ring", "1:c8c8c8:909090"]
                + ["--ring", "2:4080f0", "--fill", "ffffff", "--size", "12"]
                + list(range_options)
            )
        return out.getvalue()

    def test_a_best_radius_at_an_end_of_the_range_is_flagged(self):
        # the drawn radius is 7.5 px; each range stops short of it on one side
        for options, found in ((("--rmax", "6"), "6.00 px"), (("--rmin", "9"), "9.00 px")):
            with self.subTest(options=options):
                text = self.run_fit(*options)
                self.assertIn(f"best radius {found}", text)
                self.assertIn("WARNING: the best radius is an end of the searched range", text)

    def test_a_best_radius_inside_the_range_is_not_flagged(self):
        self.assertNotIn("WARNING", self.run_fit("--rmin", "6", "--rmax", "9"))
        self.assertFalse(corner_fit.at_search_boundary(7.5, 0.0, 14.0))

    def test_both_ends_of_the_range_are_flagged_zero_included(self):
        self.assertTrue(corner_fit.at_search_boundary(0.0, 0.0, 14.0))
        self.assertTrue(corner_fit.at_search_boundary(2.0, 2.0, 14.0))
        self.assertTrue(corner_fit.at_search_boundary(14.0, 0.0, 14.0))

    def test_a_square_corner_found_at_zero_is_flagged_as_a_boundary(self):
        image = np.empty((30, 30, 3))
        image[:] = BG
        image[10:, 10:] = FILL
        path = os.path.join(self.folder.name, "square.png")
        Image.fromarray(np.rint(image).astype(np.uint8), "RGB").save(path)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            corner_fit.main(
                ["corner_fit.py", path, "10,10", "tl", "--bg", "ececec", "--ring", "1:ffffff"]
                + ["--fill", "ffffff", "--size", "10", "--rmin", "0"]
            )
        self.assertIn("best radius 0.00 px", out.getvalue())
        self.assertIn("WARNING: the best radius is an end of the searched range", out.getvalue())


class AlphaSources(unittest.TestCase):
    """--alpha reads the transparency wherever the PNG keeps it."""

    BOX = (7, 9, 47, 39)
    RADIUS = 7.5
    # alpha levels written as greys, as --alpha takes them: shadow 18, rim 58, opaque frame 255
    SHADOW = corner_fit.rgb("121212")
    RIM = corner_fit.rgb("3a3a3a")
    OPAQUE = corner_fit.rgb("ffffff")
    RINGS = [(1.0, RIM, RIM)]

    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.TemporaryDirectory()
        levels = draw_rounded_rect(56, 50, cls.BOX, cls.RADIUS, cls.RINGS, cls.OPAQUE, cls.SHADOW)
        alpha = np.rint(levels[..., 0]).astype(np.uint8)
        colour = np.full(alpha.shape + (3,), 0x40, dtype=np.uint8)
        cls.band = os.path.join(cls.folder.name, "band.png")
        Image.fromarray(np.dstack([colour, alpha]), "RGBA").save(cls.band)
        # the same alpha as a palette image: entry i has alpha i, and every pixel's index is its alpha
        palette = Image.fromarray(alpha, "P")
        palette.putpalette([0x40] * 768)
        cls.palette = os.path.join(cls.folder.name, "palette.png")
        palette.save(cls.palette, transparency=bytes(range(256)))
        # an RGB image with one colour declared transparent: alpha is 0 there and 255 elsewhere
        keyed = np.full((30, 30, 3), 0x40, dtype=np.uint8)
        keyed[:12, :12] = (1, 2, 3)
        cls.keyed = os.path.join(cls.folder.name, "keyed.png")
        Image.fromarray(keyed, "RGB").save(cls.keyed, transparency=(1, 2, 3))
        cls.opaque = os.path.join(cls.folder.name, "opaque.png")
        Image.fromarray(keyed, "RGB").save(cls.opaque)

    @classmethod
    def tearDownClass(cls):
        cls.folder.cleanup()

    def test_the_files_are_what_the_test_says_they_are(self):
        self.assertEqual(Image.open(self.band).mode, "RGBA")
        palette = Image.open(self.palette)
        self.assertEqual(palette.mode, "P")
        self.assertNotIn("A", palette.getbands())
        self.assertIn("transparency", palette.info)
        keyed = Image.open(self.keyed)
        self.assertEqual(keyed.mode, "RGB")
        self.assertIn("transparency", keyed.info)
        self.assertNotIn("transparency", Image.open(self.opaque).info)

    def test_palette_transparency_gives_the_same_corner_as_an_alpha_band(self):
        from_band = corner_fit.load_corner(self.band, 7, 9, "tl", 12, alpha=True)
        from_palette = corner_fit.load_corner(self.palette, 7, 9, "tl", 12, alpha=True)
        np.testing.assert_array_equal(from_palette, from_band)
        self.assertEqual(from_band[0, 0, 0], 18)  # the shadow level, not the colour 0x40
        self.assertEqual(from_band[-1, -1, 0], 255)

    def test_the_radius_is_recovered_from_a_palette_png(self):
        target = corner_fit.load_corner(self.palette, 7, 9, "tl", 12, alpha=True)
        found, rms = best(corner_fit.fit(target, self.SHADOW, self.RINGS, self.OPAQUE, 2, 14, 0.25))
        self.assertEqual(found, self.RADIUS)
        self.assertLess(rms, 0.5)

    def test_a_single_transparent_colour_is_read_as_alpha(self):
        corner = corner_fit.load_corner(self.keyed, 12, 12, "tl", 6, alpha=True)
        m = corner_fit.MARGIN
        self.assertTrue((corner[:m, :m] == 0).all())  # the keyed colour, outside the corner
        self.assertTrue((corner[m:, m:] == 255).all())

    def test_an_image_without_any_transparency_is_refused(self):
        with self.assertRaises(SystemExit) as raised:
            corner_fit.load_corner(self.opaque, 12, 12, "tl", 6, alpha=True)
        self.assertIn("no alpha channel and no transparency information", str(raised.exception.code))


class Input(unittest.TestCase):
    ARGS = ["tl", "--bg", "ececec", "--ring", "1:c8c8c8", "--fill", "ffffff"]

    def test_malformed_coordinates_are_an_input_error_not_a_traceback(self):
        for xy in ("x,20", "20", "20,", "1,2,3", "1.5,2"):
            with self.subTest(xy=xy):
                with self.assertRaises(SystemExit) as raised:
                    corner_fit.main(["corner_fit.py", "no-such-file", xy] + self.ARGS)
                self.assertTrue(str(raised.exception.code).startswith(f"corner_fit: {xy} is not a corner pixel"))


if __name__ == "__main__":
    unittest.main()
