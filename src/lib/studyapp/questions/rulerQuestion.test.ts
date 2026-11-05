import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { needsRuler } from "./rulerQuestion";

describe("questions a student measures the picture for", () => {
  test("OCR Biology Q23(a)(ii), the student's own question", () => {
    assert.ok(needsRuler("Calculate the magnification of the B lymphocyte. Give your answer to 2 significant figures. Magnification = [2]"));
  });
  test("GCSE Physics: measure the image height and the object height", () => {
    assert.ok(needsRuler("Measure the image height and the object height in Figure 7. [1 mark] Image height = cm Object height = cm"));
  });
  test("GCSE Maths: use a ruler; by measuring; measure the shortest distance in millimetres; a scale diagram", () => {
    assert.ok(needsRuler("Use a ruler for this question. Here is an accurate drawing of an equilateral triangle. By measuring, work out the perimeter of the"));
    assert.ok(needsRuler("Measure the shortest distance from point P to the line. Give your answer in millimetres. Answer mm"));
    assert.ok(needsRuler("Here is a scale diagram showing towns A, B and C on a centimetre grid. Scale 1 : 200 000 19 (a) Work out the actual distance from A to B"));
    assert.ok(needsRuler("A path joins points A, B, and C. The scale drawing shows the path on a centimetre grid. Scale: 1 centimetre represents 10 metres"));
  });
  test("Geography: measure the distance on a figure", () => {
    assert.ok(needsRuler("Using Figure 16, measure the distance along the Old River Witham between point X and point Y. Shade one circle only. [1 mark]"));
    assert.ok(needsRuler("Using Figure 18, describe the shape of the valley and measure the width of the valley floor between points X and Y. [2 marks]"));
  });
  test("a scale bar, actual and image size, to the nearest millimetre, using the scale", () => {
    assert.ok(needsRuler("Use the scale bar to find the real width of the cell."));
    assert.ok(needsRuler("Figure 2 shows a chloroplast. Calculate the actual size of the chloroplast."));
    assert.ok(needsRuler("Draw the line to the nearest mm."));
    assert.ok(needsRuler("Using the scale, work out the distance between the two churches."));
    assert.ok(needsRuler("Draw the shape to scale."));
  });
  test("a length asked for in mm or cm from a picture", () => {
    assert.ok(needsRuler("Figure 3 shows a leaf. Give the length of the leaf in cm."));
  });
});

describe("questions it is not offered for", () => {
  test("measuring what is not a length: volume, mass, temperature, error", () => {
    for (const w of [
      "The student measured the length of the spring using the arrangement shown in Figure 1. Give two ways the student could have changed",
      "What type of error caused the variation in the measurements of time? [1 mark] Tick () one box.",
      "What range of volumes can be measured using the measuring cylinder? [1 mark]",
      "When measuring the volume, the student's eye was in line with the level of the water.",
      "Describe how you would measure the temperature of the solution.",
      "The student used a balance to measure the mass of the ring.",
      "At the end of the race track, the toy car passes through a light gate that measures the speed of the car. Which two measurements are needed",
      "Which metric unit would be most suitable for each measurement? Tick one box for each.",
      "Outline one disadvantage of using birth rates as a measure of development. [2 marks]",
    ]) assert.ok(!needsRuler(w), w);
  });
  test("a bare scale is not enough", () => {
    for (const w of [
      "Explain how a large-scale agricultural scheme has both advantages and disadvantages. [6 marks]",
      "Enlarge triangle PQR by scale factor 3 with centre (0, 0)",
      "Rate your confidence on a scale of 1 to 5.",
      "The Richter scale measures the strength of earthquakes.",
      "Explain how economies of scale reduce a firm's average costs.",
      "Which of the following is the pH scale?",
    ]) assert.ok(!needsRuler(w), w);
  });
  test("talk about measuring, error intervals, constructions, image-size multiple choice", () => {
    for (const w of [
      "The image size is 45 mm. Calculate the actual size of the chloroplast.",
      "How does the size of the image change when the object moves closer? Tick one box.",
      "The length of a line is 8 cm to the nearest centimetre. Write down the error interval for the length.",
      "Using ruler and compasses only, construct a scale drawing of the triangle.",
      "Make an accurate scale drawing of the plan of the garden.",
      "Table 5 shows the structures of three compounds. Diagrams not to scale. Compare the structures.",
      "A B C D Not to scale Figure 4 Figure 4 shows a trapezium ABCD where AD is parallel to BC",
      "B is 6 km due South of A. Not drawn accurately. Work out the bearing of A from C.",
      "The student used a ruler to measure the diameter of the cell. Use this information to explain the uncertainty.",
      "The scientist plans to calculate the rate of transpiration by measuring the distance moved by the air bubble.",
    ]) assert.ok(!needsRuler(w), w);
  });
  test("a calculation from numbers already given", () => {
    assert.ok(!needsRuler("A map has a scale of 1 : 4000 On the map, the distance from a station to a museum is 7 cm Is the actual distance from the station to the museum 280 m?"));
    assert.ok(!needsRuler("A map has a scale of 1 : 20 000 Two churches are 15 cm apart on the map. Work out the actual distance between them. Give your answer in km"));
    assert.ok(!needsRuler("The length of a fence panel is 160 cm to the nearest 10 cm Complete the error interval."));
    assert.ok(!needsRuler("Work out the height of the cylinder. Give your answer in cm."));
  });
  test("nothing, or nothing to read", () => {
    assert.ok(!needsRuler(undefined));
    assert.ok(!needsRuler(""));
    assert.ok(!needsRuler("State two uses of insulin. [2]"));
  });
});
