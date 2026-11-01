/** npm run app:test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deckNameFromFile, importProblemText, MAX_IMPORT_BYTES, MAX_IMPORT_CARDS, parseImport, splitRecords } from "./ankiImport";

/** What Anki 2.1.66 writes for "Notes in Plain Text", with "Include HTML and media references" ticked. */
const ANKI_HTML = [
  "#separator:tab",
  "#html:true",
  "#guid column:1",
  "#notetype column:2",
  "#deck column:3",
  "#tags column:6",
  "gB1xK9Q_2a\tBasic\tChemistry::Carbonyls\tWhat is the functional group in an aldehyde?\t<div>The carbonyl group, C=O, at the <b>end</b> of the chain</div>\tchem organic",
  "hT4pLw0c+e\tBasic\tChemistry::Carbonyls\tOxidation of ethanol<br>with excess dichromate gives?\tEthanoic acid&nbsp;(CH<sub>3</sub>COOH)\t",
  "kD8mQ2vN3r\tBasic\tChemistry::Carbonyls\tWhat is the shape around the carbon in C=O?\tTrigonal planar, 120&deg; bond angle\tgeometry",
  "mZ0sY7uE5t\tBasic\tChemistry::Carbonyls\tHalf a card with no back\t\t",
  "pA6cJ1xR9w\tBasic\tChemistry::Carbonyls\t<img src=\"paste-4f1.jpg\">\t<img src=\"paste-4f2.jpg\">\t",
].join("\n");

describe("an Anki Notes in Plain Text export", () => {
  const r = parseImport(ANKI_HTML, "Notes in Plain Text.txt");
  it("reads the declared separator and html, and finds the cards", () => {
    assert.equal(r.problem, null);
    assert.equal(r.anki, true);
    assert.equal(r.cards.length, 3);
    assert.equal(r.skipped, 2, "one with no back, one that was only pictures");
  });
  it("skips the guid, note type, deck and tags columns and takes the first two fields", () => {
    assert.equal(r.cards[0][0], "What is the functional group in an aldehyde?");
    assert.equal(r.cards[0][1], "The carbonyl group, C=O, at the end of the chain");
  });
  it("turns breaks into line breaks, subscripts into subscripts, and entities into characters", () => {
    assert.equal(r.cards[1][0], "Oxidation of ethanol\nwith excess dichromate gives?");
    assert.equal(r.cards[1][1], "Ethanoic acid (CH\u2083COOH)");
    assert.equal(r.cards[2][1], "Trigonal planar, 120\u00B0 bond angle");
  });
  it("names the deck from its deck column (the last part of Chemistry::Carbonyls)", () => {
    assert.equal(r.deckName, "Carbonyls");
  });
});

describe("an Anki export with no html and quoted fields", () => {
  const text = [
    "#separator:tab",
    "#html:false",
    "#tags column:3",
    "\"A card with a tab\tinside, and \"\"quotes\"\"\"\t\"Line one",
    "line two\"\ttags here",
    "Plain question\tPlain answer\tx",
  ].join("\n");
  const r = parseImport(text);
  it("keeps quoted fields whole, including a tab (shown as a space), doubled quotes and line breaks", () => {
    assert.deepEqual(r.cards, [["A card with a tab inside, and \"quotes\"", "Line one\nline two"], ["Plain question", "Plain answer"]]);
    assert.equal(r.skipped, 0);
  });
  it("does not strip anything that only looks like a tag when html is off", () => {
    const k = parseImport("#separator:tab\n#html:false\nIs 3 < 5 and 7 > 2?\tYes, <b>true</b>");
    assert.equal(k.cards[0][1], "Yes, <b>true</b>");
  });
});

describe("separators", () => {
  it("honours every declared separator", () => {
    for (const [name, ch] of [["comma", ","], ["semicolon", ";"], ["pipe", "|"], ["space", " "], ["tab", "\t"]] as const) {
      const r = parseImport(`#separator:${name}\nfront${ch}back${ch}extra\nfront2${ch}back2`);
      assert.deepEqual(r.cards, [["front", "back"], ["front2", "back2"]], name);
    }
  });
  it("ignores extra fields when the separator is declared, even if the answer held it unquoted", () => {
    assert.deepEqual(parseImport("#separator:semicolon\nWhy?;Because; and also this").cards, [["Why?", "Because"]]);
  });
  it("detects a tab, a semicolon, a pipe or a comma when nothing is declared", () => {
    assert.deepEqual(parseImport("Force\tNewton\nEnergy\tJoule").cards, [["Force", "Newton"], ["Energy", "Joule"]]);
    assert.deepEqual(parseImport("Force; Newton\nEnergy; Joule").cards, [["Force", "Newton"], ["Energy", "Joule"]]);
    assert.deepEqual(parseImport("Force | Newton\nEnergy | Joule").cards, [["Force", "Newton"], ["Energy", "Joule"]]);
    assert.deepEqual(parseImport("Force,Newton\nEnergy,Joule\nPower,Watt").cards, [["Force", "Newton"], ["Energy", "Joule"], ["Power", "Watt"]]);
  });
  it("reads a CSV with quoted commas", () => {
    const r = parseImport("\"Name two, please\",\"Mg, Ca\"\nOne,Two\n\"Say \"\"hi\"\"\",Hello");
    assert.deepEqual(r.cards, [["Name two, please", "Mg, Ca"], ["One", "Two"], ["Say \"hi\"", "Hello"]]);
  });
  it("does not mistake prose commas for a separator", () => {
    const r = parseImport("Define a mole, briefly\nName the lightest element, and its symbol, please\nWhat is a catalyst?\nList the halogens, in order, from the top");
    assert.equal(r.problem, "no_cards");
    assert.equal(r.skipped, 4);
  });
  it("keeps a semicolon in the answer when two columns were detected, not declared", () => {
    assert.deepEqual(parseImport("What is x; why?; Because; and more\nA; B").cards, [["What is x", "why?; Because; and more"], ["A", "B"]]);
  });
  it("falls back to splitting each line at its own tab, semicolon or bar when no one separator runs through the text", () => {
    const r = parseImport("Unit of rate?; mol dm\u207B\u00B3 s\u207B\u00B9\nWhat is a catalyst?\tIt speeds up a reaction\nthis line has no separator");
    assert.deepEqual(r.cards, [["Unit of rate?", "mol dm\u207B\u00B3 s\u207B\u00B9"], ["What is a catalyst?", "It speeds up a reaction"]]);
    assert.equal(r.skipped, 1);
  });
  it("ignores a third column on a tab file that was not declared", () => {
    assert.deepEqual(parseImport("a\tb\tnotes\nc\td\tmore").cards, [["a", "b"], ["c", "d"]]);
  });
  it("handles Windows line endings, a byte order mark and blank lines", () => {
    const r = parseImport("\uFEFFa\tb\r\n\r\nc\td\r\n");
    assert.deepEqual(r.cards, [["a", "b"], ["c", "d"]]);
    assert.equal(r.skipped, 0);
  });
});

describe("cloze notes", () => {
  it("asks for the blank and answers with the sentence", () => {
    const r = parseImport("#separator:tab\n#html:true\nThe {{c1::mitochondria}} is the site of {{c2::aerobic respiration::process}}.\tPowerhouse of the cell");
    assert.equal(r.cards[0][0], "The [...] is the site of [...].");
    assert.equal(r.cards[0][1], "The mitochondria is the site of aerobic respiration.\nPowerhouse of the cell");
  });
});

describe("hostile input is only ever text", () => {
  const html = (f: string, b = "ok") => parseImport(`#separator:tab\n#html:true\n${f}\t${b}`).cards[0];
  it("strips tags, including ones rebuilt by nesting, and never leaves a tag in", () => {
    for (const evil of ["<script>alert(1)</script>Hi", "<scr<script>ipt>alert(1)</scr</script>ipt>Hi", "<img src=x onerror=alert(1)>Hi", "<a href=\"javascript:alert(1)\">Hi</a>", "<svg/onload=alert(1)>Hi", "<<b>b>Hi"]) {
      const c = html(evil)?.[0] ?? "";
      assert.ok(!/<\s*\/?\s*[a-z!]/i.test(c), `no tag left in: ${JSON.stringify(c)}`);
      assert.ok(c.endsWith("Hi") || c === "", c);
    }
  });
  it("decodes entities once, so an escaped tag stays visible text and does not become one", () => {
    assert.equal(html("&lt;b&gt;bold&lt;/b&gt; and &amp;lt; and &#60;i&#62;")?.[0], "<b>bold</b> and &lt; and <i>");
  });
  it("drops invalid numeric entities and control or direction-changing characters", () => {
    assert.equal(html("a&#0;b&#xD800;c&#1114112;d")?.[0], "abcd");
    assert.equal(parseImport("a\u202Eb\u0001c\u200Bd\tzzz").cards[0][0], "abcd");
  });
  it("turns script-looking text without html on into plain characters, never markup", () => {
    const c = parseImport("<script>alert(1)</script>\t<b>x</b>").cards[0];
    assert.deepEqual(c, ["<script>alert(1)</script>", "<b>x</b>"]);
  });
  it("is not slow on many stray quotes", () => {
    const t0 = Date.now();
    const r = parseImport(("\"a\tb\n").repeat(4_000));
    assert.equal(r.problem, null);
    assert.equal(parseImport("\"a\n".repeat(250_000)).problem, "no_cards");
    assert.ok(Date.now() - t0 < 2000, "linear, not quadratic");
  });
  it("is not slow on a long run of angle brackets", () => {
    const t0 = Date.now();
    parseImport("#separator:tab\n#html:true\n" + "<".repeat(100_000) + "\tback");
    assert.ok(Date.now() - t0 < 2000);
  });
});

describe("limits and refusals", () => {
  it("refuses Anki packages by name and by content, with a way forward", () => {
    assert.equal(parseImport("", "Chemistry.apkg").problem, "package");
    assert.equal(parseImport("PK\u0003\u0004binary", "x.txt").problem, "package");
    assert.equal(parseImport("a\u0000b\tc").problem, "package");
    assert.match(importProblemText("package"), /Notes in Plain Text/);
    assert.match(importProblemText("package"), /\.apkg/);
  });
  it("refuses an empty paste, and a file that is only headers", () => {
    assert.equal(parseImport("   \n ").problem, "empty");
    assert.equal(parseImport("#separator:tab\n#html:true\n").problem, "no_cards");
  });
  it("refuses more than 1 MB with a plain message", () => {
    const r = parseImport("a\tb\n".repeat(MAX_IMPORT_BYTES / 4 + 10));
    assert.equal(r.problem, "too_big");
    assert.match(importProblemText("too_big"), /1 MB/);
  });
  it("refuses more than 5000 cards and accepts exactly 5000", () => {
    assert.equal(parseImport("a\tb\n".repeat(MAX_IMPORT_CARDS)).cards.length, MAX_IMPORT_CARDS);
    const r = parseImport("a\tb\n".repeat(MAX_IMPORT_CARDS + 1));
    assert.equal(r.problem, "too_many");
    assert.equal(r.cards.length, 0);
    assert.match(importProblemText("too_many"), /5000/);
  });
  it("says how many cards are longer than a card holds", () => {
    const r = parseImport(`short\tshort\n${"q".repeat(450)}\tok\nok\t${"a".repeat(900)}`);
    assert.equal(r.cards.length, 3);
    assert.equal(r.cut, 2);
  });
  it("uses no em dashes in anything a student reads", () => {
    for (const p of ["empty", "too_big", "too_many", "package", "no_cards"] as const) assert.ok(!/[\u2014]/.test(importProblemText(p)));
  });
});

describe("splitting into records", () => {
  it("keeps a trailing empty field and does not invent a record after the last line break", () => {
    assert.deepEqual(splitRecords("a\tb\t\nc\td\n", "\t"), [["a", "b", ""], ["c", "d"]]);
    assert.deepEqual(splitRecords("", "\t"), []);
    assert.deepEqual(splitRecords("a\t", "\t"), [["a", ""]]);
  });
  it("treats a quote that never closes as an ordinary character", () => {
    assert.deepEqual(splitRecords("\"open\tb\nc\td", "\t"), [["\"open", "b"], ["c", "d"]]);
  });
});

describe("deck names from file names", () => {
  it("tidies a file name and ignores Anki's own default names", () => {
    assert.equal(deckNameFromFile("Chemistry_Rates.txt"), "Chemistry Rates");
    assert.equal(deckNameFromFile("C:\\Users\\sam\\Biology cells.csv"), "Biology cells");
    assert.equal(deckNameFromFile("Notes in Plain Text.txt"), null);
    assert.equal(deckNameFromFile(".txt"), null);
  });
});
