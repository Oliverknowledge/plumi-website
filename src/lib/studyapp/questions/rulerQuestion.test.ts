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
  });
  test("a length asked for in mm or cm from a picture", () => {
    assert.ok(needsRuler("The diagram shows a leaf. Give the length of the leaf in cm."));
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
  test("the critic's misses in AQA and OCR biology, read from the full text", () => {
    assert.ok(needsRuler("0 6 . 4 figure 6 shows an image from an optical microscope of a single bacterial cell. figure 6 this bacterial cell is 2.3 μm long (excluding the flagellum). calculate the magnification of this image. show your working. [2 marks] magnification × question marking guidance mark comments 06.4 correct answer of 19 565 (from measurement of 45mm)"));
    assert.ok(needsRuler("calculate the magnification of the image shown in figure 1. [1 mark] 0 2 . 4 answer = 02.4 length of bar in mm × 1000; 1"));
    assert.ok(needsRuler("0 4 scientists investigated the activation of t lymphocytes. figure 5 shows electron microscope images of the two types of cell. the activated helper t cell has a volume of 463 μm3 0 4 . 1 calculate the volume of the naïve t cell shown in figure 5. use line pq to measure the diameter of the naïve t cell. [3 marks]"));
    assert.ok(needsRuler("figure 7 0 7 . 1 hbv infects a liver cell. the liver cell is 25 µm in diameter. use figure 7 to calculate how many times larger in diameter this cell is than hbv. you should use the lipid layer to measure the diameter of hbv. [2 marks] answer times larger"));
    assert.ok(needsRuler("figure 2 0 1 . 3 calculate the maximum length of the large lipid droplet marked x in figure 2. using a ruler with millimetre intervals always includes an uncertainty in the measurement. use the uncertainty in your measurement to determine the uncertainty of your calculated maximum length. [4 marks]"));
    assert.ok(needsRuler("3 xylem vessels maintain the transpiration stream. (ii) this is a light micrograph of a transverse section through the stem of p. vulgaris. v × × 90 the diameter of one of the vascular bundles is shown by the line labelled v. calculate the actual diameter of the vascular bundle labelled v. give your answer in mm and to 2 significant figures. diameter of the vascular bundle v = mm [2] question answer mark guidance 3 (b) (ii)"));
    assert.ok(needsRuler("a train travels from town a to town b. figure 14 shows the route taken by the train. figure 14 has been drawn to scale. figure 14 0 8 use figure 14 to determine the displacement of the train in travelling from a to b. show how you obtain your answer. [2 marks] displacement = km"));
  });
  test("the part's own question is read with its label; the stem is context only", () => {
    // positives
    assert.ok(needsRuler("0 5 some people wear glasses. figure 6 shows parallel rays. figure 7 shows a lens forming a magnified image of an object. figure 7 0 5 . 4 measure the image height and the object height in figure 7. [1 mark] image height = cm", "05.4"));
    assert.ok(needsRuler("0 5 this question is about the human circulatory system. 0 5 . 2 figure 5 shows a red blood cell. figure 5 the image of the red blood cell in figure 5 is magnified 7200 times. calculate the real diameter of the red blood cell. give your answer in micrometres (µm). [5 marks]", "05.2"));
    assert.ok(needsRuler("0 4 figure 3 shows a microscope. figure 4 0 4 . 5 line a–b in figure 4 shows the length of cell z. calculate the real length of cell z. complete the following steps. [4 marks]", "04.5"));
    assert.ok(needsRuler("5 the map shows the positions of two ships, a and b. scale: 1 cm represents 2.5 km b a work out the actual distance between the ships. answer km 5 [8.4, 8.8] ( 2.5) m1", "5"));
    assert.ok(needsRuler("10 here is a scale drawing. the ferris wheel has a height of 130 m work out the height of the building. answer m 10 alternative method 1", "10"));
    assert.ok(needsRuler("(d) study figure 2 which shows a satellite image of a hurricane in the usa. b x a scale: 1 cm = 100 km figure 2 (i) identify the diameter of the hurricane, shown by the line a–b, on figure 2. (1) a 401–500 km b 501–600 km question indicative content mark number 1(d)(i) line a-b is over 7cms.", "1(d)(i)"));
    assert.ok(needsRuler("0 2 figure 3 shows the route an aeroplane takes. figure 3 has been drawn to scale. figure 3 0 2 . 1 determine the magnitude of the aeroplane’s displacement from the start point to the finish point on figure 3. [2 marks]", "02.1"));
    assert.ok(needsRuler("4 (a) (ii) the magnification of the microscope used to observe the cells in fig. 4.1 was ×950. calculate the diameter of cell x in fig. 4.1. give your answer in µm. [3]", "4(a)(ii)"));
    // negatives: a method of numbered steps in the stem, a ruler used to cut, a list of guidelines
    assert.ok(!needsRuler("0 3 a student investigated the acceleration of a ball. this is the method used. 1. measure a vertical height above the floor. 2. hold the gravity ball at the measured height. 0 3 . 2 what type of error caused the variation in the measurements of time? [1 mark]", "03.2"));
    assert.ok(!needsRuler("17 catalase is found in many tissues. 2. cut 15 cylinders of potato of equal diameter, using a cork borer, and use a ruler to ensure that each one is 5 cm long. (ii) describe how a student could produce an 8 a.u. solution from a 20 a.u. stock solution. [2]", "17(a)(ii)"));
    assert.ok(!needsRuler("(d) a student planned to carry out a dissection. they were advised to observe the following guidelines: • use a sharp pencil • use ruled label lines • include a scale bar. suggest two further guidelines for the student to follow. [2]", "16(d)"));
    assert.ok(!needsRuler("0 3 . 3 the scientists determined the mean diameter of muscle fibres using an optical microscope. the circular area of one field of view was 1.25 mm2. the diameter of this area was equal to the diameter of 15 muscle fibres. using this information, calculate the mean diameter in µm (micrometres) of muscle fibres in this section of tissue. figure 3 [3 marks]", "03.3"));
    assert.ok(!needsRuler("14. a balloon is being inflated. in a simple model, the balloon is modelled as a sphere. find the time when the radius reaches 10 cm. give your answer to the nearest cm. (4)", "14"));
    assert.ok(!needsRuler("0 1 the length of the image of the ichthyosaur in figure 1 is 120 mm. the real length of the ichthyosaur was 17 times longer than the image in figure 1. 0 1 . 2 calculate the real length of the ichthyosaur. give your answer in metres. [3 marks]", "01.2"));
    assert.ok(!needsRuler("0 3 . 2 the length of cell z in figure 3 is 4.8 cm. calculate the real length of cell z. give your answer in micrometres (µm). [5 marks]", "03.2"));
    assert.ok(!needsRuler("20 a map of an island is shown on a centimetre grid. a, b and c are houses. 20 (a) the actual distance between a and b is 1500 metres. show that the scale on the map is 1 : 30 000 20 (b) work out the actual distance between a and c.", "20"));
  });
  test("only the question is read, not the mark scheme that follows it", () => {
    assert.ok(!needsRuler("calculate the volume of the cell. [2 marks] question marking guidance mark comments measure the length of the scale bar with a ruler"));
    assert.ok(!needsRuler("(ii) calculate the volume. [2] (ii) first check on answer line. measure the length of side x in mm"));
  });
  test("grids, constructions, given lengths and a magnification with nothing to measure", () => {
    for (const w of [
      "a scale drawing shows the positions of p, q and r. on the scale drawing pq = 4 cm qr = 6.5 cm the actual distance pq is 50 metres less than the actual distance qr. work out the scale. not drawn accurately answer 1 cm represents metres q answer mark comments 19",
      "14 use a ruler and compasses in this question. the scale diagram shows port p and lighthouse q. scale: 1 cm represents 2 km a ship is less than 14 km from p and closer to q than to p. label the region, r, where the ship could be. show all your construction lines. q answer mark comments",
      "14 the scale drawing represents a garden. water from a sprinkler at p reaches up to 20 metres from p. scale: 1 cm represents 5 m using a pair of compasses, show the region that water from both sprinklers reaches. 14 arc radius [3.8, 4.2] cm",
      "3 a path joins points a, b, and c. the scale drawing shows the path on a centimetre grid. scale: 1 centimetre represents 10 metres 3 (a) write down the direction of b from a. answer 3 (b) work out the actual distance along the path from a to c. answer metres q answer mark comments",
      "3 a student counted stomata on a leaf using a light microscope. the image below shows the stomata that were visible. the image magnification is ×60. which of the options, a to d, is the correct stomatal density of this leaf? 7.50 stomata mm–2 a 0.13 stomata mm–2 b [1] your answer",
      "a train travels from town a to town b. figure 14 shows the route taken by the train. figure 14 has been drawn to scale. figure 14 0 8 there are places on the journey where the train accelerates without changing speed explain how this can happen. [2 marks]",
      "a train travels from town a to town b. figure 14 has been drawn to scale. what is the difference between distance and displacement? [1 mark]",
      "here is a scale diagram showing towns a, b and c on a centimetre grid. scale 1 : 200 000 19 (a) work out the actual distance from b to c. give your answer in kilometres. q answer mark comments",
      "Draw the shape to scale.",
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
