"""Write OCR's A-Level Psychology (H567) topic tree for the bank.

    python3 scripts/question-bank/ocr_psychology/spec_ocr_psychology.py [work-dir]   # default .work/ocr-psychology

Set out by hand from the specification (https://www.ocr.org.uk/Images/171732-specification-accredited-a-level-gce-psychology-h567.pdf,
section 2c), whose content is tables rather than numbered statements: Component 1's research methods
(1.1-1.6), split by method and skill so a Paper 1 question finds its topic; Component 2's core studies,
one topic per key theme and its pair of studies, its areas, perspectives and debates, and its practical
applications; Component 3's issues in mental health and its four options, a topic per row of each
option's table. No topic has a printed code, so `ref` is empty and the bank shows none. `year` is 3 for
an option's topics ("Paper 3 options"), 0 for the rest; an option's section carries its `option`, so the
bank's Option filter keeps the options a student sits. `text` is for tagging only.
Writes <work-dir>/spec.json in spec_ocr.py's shape, under H567.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-psychology"))

OPTIONS = [("child", "Child psychology"), ("criminal", "Criminal psychology"), ("environmental", "Environmental psychology"), ("sport", "Sport and exercise psychology")]
SECTIONS = [
    ("1", "Research methods", None, [
        ("Experiments", "laboratory experiment, field experiment, quasi experiment, independent variable, dependent variable, cause and effect"),
        ("Observations", "structured, unstructured, naturalistic, controlled, participant, non-participant, overt, covert observation; behavioural categories, coding frames, time sampling, event sampling"),
        ("Self-reports", "questionnaires; structured, semi-structured and unstructured interviews; open and closed questions; rating scales, Likert, semantic differential"),
        ("Correlations", "obtaining data for correlational analysis; positive, negative and no correlation; scatter diagrams; correlation coefficients"),
        ("Aims and hypotheses", "research aim, research question, null hypothesis, alternative hypothesis, one-tailed (directional), two-tailed (non-directional)"),
        ("Sampling", "target population, sample, random, snowball, opportunity, self-selected (volunteer) sampling; representativeness, generalisability"),
        ("Experimental designs", "repeated measures, independent measures, matched participants design; order effects, counterbalancing, participant variables"),
        ("Variables and controls", "operationalising the IV and DV; extraneous and confounding variables; controls, standardisation"),
        ("Levels and types of data", "nominal, ordinal, interval data; quantitative and qualitative data; primary and secondary data; raw data tables"),
        ("Descriptive statistics and graphs", "mean, median, mode, range, variance, standard deviation, percentages, ratios, fractions, significant figures, estimation; bar charts, histograms, line graphs, pie charts, frequency tables"),
        ("Inferential statistics", "normal and skewed distributions, probability, significance levels, critical values, chi-squared, binomial sign, Wilcoxon, Mann-Whitney U, Spearman's rho, type 1 and type 2 errors, choosing a test"),
        ("Reliability and validity", "internal, external, inter-rater, test-retest, split-half reliability; ecological validity, demand characteristics, social desirability, researcher bias and effects"),
        ("Ethics", "BPS code of ethics and conduct: respect, competence, responsibility, integrity; informed consent, right to withdraw, confidentiality, deception, debrief, protection from harm"),
        ("Report writing and peer review", "abstract, introduction, method, results, discussion, references, appendices; Harvard referencing; peer review"),
        ("How science works", "cause and effect, falsification, replicability, objectivity, induction, deduction, hypothesis testing, manipulation of variables, quantifiable measurements"),
    ]),
    ("2A", "Core studies", None, [
        ("Responses to people in authority", "Milgram (1963) obedience; Bocchiaro et al. (2012) disobedience and whistle-blowing"),
        ("Responses to people in need", "Piliavin et al. (1969) Subway Samaritan; Levine et al. (2001) cross-cultural altruism"),
        ("Memory", "Loftus and Palmer (1974) eyewitness testimony; Grant et al. (1998) context-dependent memory"),
        ("Attention", "Moray (1959) auditory attention; Simons and Chabris (1999) visual inattention"),
        ("External influences on children's behaviour", "Bandura et al. (1961) transmission of aggression; Chaney et al. (2004) Funhaler study"),
        ("Moral development", "Kohlberg (1968) stages of moral development; Lee et al. (1997) evaluations of lying and truth-telling"),
        ("Regions of the brain", "Sperry (1968) split brain study; Casey et al. (2011) neural correlates of delay of gratification"),
        ("Brain plasticity", "Blakemore and Cooper (1970) impact of early visual experience; Maguire et al. (2000) taxi drivers"),
        ("Understanding disorders", "Freud (1909) Little Hans; Baron-Cohen et al. (1997) autism in adults, Eyes Task"),
        ("Measuring differences", "Gould (1982) A nation of morons, bias in IQ testing; Hancock et al. (2011) language of psychopaths"),
    ]),
    ("2B", "Areas, perspectives and debates", None, [
        ("The social area", "defining principles, research, strengths, weaknesses, applications of the social area"),
        ("The cognitive area", "defining principles, research, strengths, weaknesses, applications of the cognitive area"),
        ("The developmental area", "defining principles, research, strengths, weaknesses, applications of the developmental area"),
        ("The biological area", "defining principles, research, strengths, weaknesses, applications of the biological area"),
        ("The individual differences area", "defining principles, research, strengths, weaknesses, applications of the individual differences area"),
        ("The behaviourist perspective", "behaviourism, learning, conditioning; strengths, weaknesses, applications"),
        ("The psychodynamic perspective", "psychodynamic perspective, unconscious, Freud; strengths, weaknesses, applications"),
        ("Nature and nurture", "nature/nurture debate"),
        ("Free will and determinism", "freewill/determinism debate"),
        ("Reductionism and holism", "reductionism/holism debate"),
        ("Individual and situational explanations", "individual/situational explanations debate"),
        ("Usefulness of research", "usefulness of psychological research"),
        ("Ethical considerations", "ethical considerations as a debate"),
        ("Socially sensitive research", "conducting socially sensitive research"),
        ("Psychology as a science", "psychology as a science; scientific method"),
    ]),
    ("2C", "Practical applications", None, [
        ("Applying psychology to a source", "recognise the psychological content in a source (article); make evidence-based suggestions; strengths and weaknesses of the suggestions"),
    ]),
    ("3A", "Issues in mental health", None, [
        ("The historical context of mental health", "historical views of mental illness; defining abnormality; categorising mental disorders (DSM, ICD); Rosenhan (1973) On being sane in insane places; characteristics of affective, psychotic and anxiety disorders"),
        ("The medical model", "biochemical, genetic and brain abnormality explanations of mental illness; Gottesman et al. (2010) disorders in offspring with two psychiatrically ill parents; biological treatment of one disorder"),
        ("Alternatives to the medical model", "behaviourist, cognitive, humanistic, psychodynamic, cognitive neuroscience explanations of mental illness; Szasz (2011) The myth of mental illness; non-biological treatment of one disorder"),
    ]),
    ("3B", "Child psychology", "child", [
        ("Intelligence", "what psychologists mean by intelligence; biological factors; Van Leeuwen et al. (2008) twin-family study of general IQ; methods of assessing intelligence"),
        ("Pre-adult brain development", "brain development and risk taking; Barkley-Levenson and Galván (2014) expected value in the adolescent brain; strategies to reduce risk taking"),
        ("Perceptual development", "perceptual development in children, studied in babies and animals; Gibson and Walk (1960) visual cliff; play strategies to develop perception"),
        ("Cognitive development and education", "cognitive development and education; Wood et al. (1976) role of tutoring in problem-solving, scaffolding; cognitive strategies for revision or learning"),
        ("Development of attachment", "attachment in babies, failure to develop attachments; Ainsworth and Bell (1970) Strange Situation; attachment-friendly environments"),
        ("Impact of advertising on children", "television advertising, stereotyping; Johnson and Young (2002) gendered voices in children's advertising; reducing impact of advertising"),
    ]),
    ("3C", "Criminal psychology", "criminal", [
        ("What makes a criminal?", "physiological and non-physiological explanations of criminal behaviour; Raine et al. (1997) brain abnormalities in murderers, PET; biological strategies for preventing crime"),
        ("Collection and processing of forensic evidence", "motivating factors and bias in forensic evidence; Hall and Player (2008) emotional context and fingerprint analysis; reducing bias"),
        ("Collection of evidence", "evidence from witnesses and suspects; Memon and Higham (1999) review of the cognitive interview; police interview strategies"),
        ("Psychology and the courtroom", "how juries are persuaded by witness and defendant characteristics; Dixon et al. (2002) accent and context in perceptions of guilt; influencing jury decisions"),
        ("Crime prevention", "neighbourhood features, zero tolerance; Wilson and Kelling (1982) broken windows; crime prevention strategies"),
        ("Effect of imprisonment", "punishment and reform; Haney et al. (1973) simulated prison; reducing reoffending"),
    ]),
    ("3D", "Environmental psychology", "environmental", [
        ("Stressors in the environment", "environmental stressors, noise, biological stress responses; Black and Black (2007) aircraft noise and hypertension; managing environmental stress"),
        ("Biological rhythms", "circadian rhythms and disruption; Czeisler et al. (1982) rotating shift work; reducing effects of jet lag or shift work"),
        ("Recycling and other conservation behaviours", "factors influencing conservation and recycling; Lord (1994) motivating recycling behaviour; techniques to increase recycling"),
        ("Ergonomics: human factors", "cognitive overload, observation in the workplace; Drews and Doig (2014) configural vital sign display; workplace design"),
        ("Psychological effects of the built environment", "built environment, urban renewal, wellbeing; Ulrich (1984) view through a window and recovery from surgery; environmental design for health"),
        ("Territory and personal space", "territory and personal space in the workplace; Wells (2000) office personalisation; office design"),
    ]),
    ("3E", "Sport and exercise psychology", "sport", [
        ("Arousal and anxiety", "optimising arousal, controlling and measuring anxiety in sport; Fazey and Hardy (1988) inverted-U, catastrophe theory; managing arousal and anxiety"),
        ("Exercise and mental health", "benefits of exercise to mental health; Lewis et al. (2014) social dance and Parkinson's disease; exercise strategies"),
        ("Motivation", "self-efficacy, sports confidence, imagery, sports orientation; Munroe-Chandler et al. (2008) imagery in youth soccer; motivating athletes"),
        ("Personality", "personality, its measurement and sport; Kroll and Crenshaw (1970) personality profiles of athletes; using personality to improve performance"),
        ("Performing with others", "teams, coaching, leadership; Smith et al. (1979) coach effectiveness training; improving team performance"),
        ("Audience effects", "social facilitation, home advantage; Zajonc et al. (1969) cockroaches; training for spectator sports"),
    ]),
]


def main():
    tree = {"sections": [], "topics": []}
    for code, title, option, topics in SECTIONS:
        tree["sections"].append({"code": code, "title": title, **({"option": option} if option else {})})
        for n, (name, text) in enumerate(topics, 1):
            tree["topics"].append({"code": f"{code}.{n}", "ref": "", "title": name, "section": code, "text": text, "year": 3 if option else 0})
    os.makedirs(WORK, exist_ok=True)
    json.dump({"H567": tree, "options": [{"id": i, "name": n} for i, n in OPTIONS]}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(tree['sections'])} sections, {len(tree['topics'])} topics", file=sys.stderr)


if __name__ == "__main__":
    main()
