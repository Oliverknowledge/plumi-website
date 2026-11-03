"""AQA's GCSE Citizenship Studies specification (8100) as the bank's topic tree.

    python3 scripts/question-bank/aqa_gcse_citizenship/spec_gcse_citizenship.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-citizenship

From the specification on AQA's 8100 page (AQA-8100-SP-2016, version 1.1:
https://filestore.aqa.org.uk/resources/citizenship/specifications/AQA-8100-SP-2016.PDF). Writes
<work-dir>/spec.json under 8100, in the GCSE Psychology bank's shape. Sections are the four themes
as the bank's tiles: 3.2 Life in modern Britain and 3.3 Rights and responsibilities (Paper 2),
3.4 Politics and participation and 3.5 Active citizenship (Paper 1). The specification frames each
theme as five key questions with bulleted content: topics are those bullets, numbered under their
key question ("3.4.3.2"), with bullets that are one idea joined ("the role of the Prime Minister,
cabinet and ministers" and "the formation of government") and given a short name. Each theme's
fifth key question (how citizens make a difference) is what Paper 1's Active citizenship section
examines (3.5.1 says so), so its actions and groups are kept once, under 3.5.1, with the
investigation's stages (3.5.2) beside them. "text" is a summary of the bullets' content, for tagging only.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-citizenship")

SECTIONS = [("3.2", "Life in modern Britain"), ("3.3", "Rights and responsibilities"),
            ("3.4", "Politics and participation"), ("3.5", "Active citizenship")]
# (code, title, what the specification covers there)
TOPICS = [
    # 3.2.1 What are the principles and values that underpin British society?
    ("3.2.1.1", "British values", "key principles and values underpinning British society today: democracy, rule of law, individual liberty, mutual respect, tolerance"),
    ("3.2.1.2", "Rights, duties and freedoms of citizens", "human, moral, legal and political rights; duties, equalities and freedoms of citizens"),
    ("3.2.1.3", "Identity", "factors that create individual, group, national and global identities; identity and multiple identities; the diverse nature of the UK population"),
    # 3.2.2 What do we mean by identity?
    ("3.2.2.1", "The four nations and national identity", "the UK of England, Northern Ireland, Scotland and Wales; the impact on identity debates; Britishness"),
    ("3.2.2.2", "Migration and immigration", "changes and movement of population over time; impact on communities; immigration and emigration to and from the UK"),
    ("3.2.2.3", "Mutual respect and diversity", "the need for mutual respect and understanding in a diverse society; multiculturalism, integration, tolerance; values underpinning democratic society"),
    # 3.2.3 What is the role of the media and the free press?
    ("3.2.3.1", "The media and free press", "rights, responsibilities and role of the media and a free press: informing and influencing public opinion, a forum for ideas, holding those in power to account; citizen journalism, social media"),
    ("3.2.3.2", "Public interest, accuracy and privacy", "the media's right to investigate and report on issues of public interest; accuracy; respect for privacy and dignity"),
    ("3.2.3.3", "Press regulation and censorship", "how the press is regulated (IPSO, IMPRESS, Ofcom, Leveson Inquiry); examples of censorship"),
    # 3.2.4 What is the UK's role in key international organisations?
    ("3.2.4.1", "The UK and international organisations", "UK relationships with the UN and its agencies, NATO, the EU, the Council of Europe, the Commonwealth and the WTO; soft and hard power"),
    ("3.2.4.2", "Brexit and the UK's former EU membership", "ongoing implications of the UK's former membership of the European Union; decisions that continue to impact the UK"),
    ("3.2.4.3", "Resolving international disputes and conflicts", "how the UK helps resolve international disputes and conflicts: diplomacy, mediation, sanctions, aid, use of force"),
    ("3.2.4.4", "NGOs and humanitarian crises", "how non-governmental organisations (NGOs) respond to humanitarian crises"),
    # 3.2.5 How can citizens make their voice heard and make a difference in society?
    ("3.2.5.1", "Barriers to participation in democracy", "opportunities for and barriers to citizen participation in democracy"),
    # 3.3.1 What laws does a society require and why?
    ("3.3.1.1", "Principles of law", "fundamental principles of law to ensure rights and freedoms: presumption of innocence, equality before the law, rule of law, due process"),
    ("3.3.1.2", "Laws, fairness and discrimination", "rules and laws helping society deal with problems of fairness, justice and discrimination; equality legislation (Equality Act)"),
    ("3.3.1.3", "Balancing rights and responsibilities", "rights in local to global situations where there is conflict and rights and responsibilities need to be balanced"),
    # 3.3.2 What are a citizen's rights and responsibilities within the legal system?
    ("3.3.2.1", "The police", "the role and powers of the police: arrest, stop and search, warrants; police community support officers"),
    ("3.3.2.2", "Judges and legal representatives", "the role and powers of the judiciary; the roles of legal representatives: solicitors, barristers, legal executives"),
    ("3.3.2.3", "Courts, tribunals and dispute resolution", "how criminal and civil courts work: magistrates', Crown, county, High Court, Supreme Court, youth courts; tribunals and other dispute resolution (mediation, arbitration, ombudsman)"),
    ("3.3.2.4", "Legal ages and the age of criminal responsibility", "rights and legal entitlements at different ages: age of criminal responsibility; ages to drive, marry, vote, join the forces"),
    ("3.3.2.5", "Civil law and criminal law", "how civil law differs from criminal law"),
    ("3.3.2.6", "Legal systems in the UK", "how the legal systems differ in England and Wales, Northern Ireland and Scotland (sheriff courts, ages)"),
    # 3.3.3 How has the law developed over time, and how does the law protect the citizen and deal with criminals?
    ("3.3.3.1", "How rights have developed", "how citizens' rights changed over time, from Magna Carta (1215) to the Human Rights Act (1998)"),
    ("3.3.3.2", "Common law and legislation", "common law (judge-made, precedent) and legislation (statute), and how they differ"),
    ("3.3.3.3", "Trade unions and employers' associations", "the right to representation; the role and history of trade unions in supporting and representing workers; employers' associations"),
    ("3.3.3.4", "Crime in the UK", "the nature of criminality today: types of crime, the profile of criminality, factors affecting crime rates, strategies to reduce crime"),
    ("3.3.3.5", "Punishment and sentencing", "forms of punishment in the UK; purposes of sentencing (deterrence, rehabilitation, reparation, protection, punishment); effectiveness of different sentences"),
    ("3.3.3.6", "The youth justice system", "how the youth justice system operates: youth courts, referral and reparation orders, youth offending teams"),
    # 3.3.4 What are the universal human rights and how do we protect them?
    ("3.3.4.1", "Human rights agreements", "the UN Universal Declaration of Human Rights, the European Convention on Human Rights, the UN Convention on the Rights of the Child, the Human Rights Act (1998)"),
    ("3.3.4.2", "International law in conflict", "international law protecting victims of conflict; international humanitarian law and the rules of war (Geneva and Hague Conventions, International Criminal Court)"),
    # 3.3.5 How do citizens play a part to bring about change in the legal system?
    ("3.3.5.1", "Citizens' roles in the legal system", "roles of citizens in the legal system: juror, witness, victim of crime, magistrate, special constable, police and crime commissioner, member of a tribunal panel"),
    # 3.4.1 Where does political power reside in the UK and how is it controlled?
    ("3.4.1.1", "Democracy and its forms", "the concept of democracy and its forms: direct and representative democracy; referendums"),
    ("3.4.1.2", "Values underpinning democracy", "rights, responsibilities, freedoms, equality, the rule of law"),
    ("3.4.1.3", "The British constitution", "institutions of the British constitution: government, Prime Minister and cabinet, sovereignty of Parliament, legislature, opposition, parties, Monarch, citizens, judiciary, police, civil service; an uncodified constitution and how it is changing"),
    # 3.4.2 What are the powers of local and devolved government and how can citizens participate?
    ("3.4.2.1", "Local government", "role and structure of elected local government; services councils provide; roles and accountability of councillors; elected mayors"),
    ("3.4.2.2", "Devolution", "regional and devolved government in Scotland, Wales, Northern Ireland and England; powers between Westminster and the devolved administrations; English votes for English laws"),
    ("3.4.2.3", "Standing for election", "who can stand for election and how candidates are selected"),
    ("3.4.2.4", "Who can vote and the voting age", "who can and cannot vote in elections and why; debates about the voting age"),
    ("3.4.2.5", "Voter turnout and apathy", "voter turnout and apathy, and suggestions for increasing turnout"),
    ("3.4.2.6", "Taxation and public spending", "how taxes are raised and spent locally and nationally; budgeting and managing risk; allocation of public funding; debates about provision for welfare, health, the elderly and education"),
    # 3.4.3 Where does political power reside: with the citizen, parliament or government?
    ("3.4.3.1", "First Past the Post", "the First Past the Post system based on parliamentary constituencies; the frequency of Westminster elections"),
    ("3.4.3.2", "Other voting systems", "other voting systems used in UK elections (AMS, STV, Supplementary Vote, party list), proportional systems, their advantages and disadvantages"),
    ("3.4.3.3", "Parliament and the monarchy", "executive, legislature, judiciary and monarchy; the bicameral Westminster Parliament, the House of Commons and the House of Lords; the role of the monarch; royal assent"),
    ("3.4.3.4", "Political parties", "the major parties contesting UK general elections; philosophical differences between them (left and right, nationalist parties)"),
    ("3.4.3.5", "How Parliament scrutinises government", "scrutinising government and making it accountable: parliamentary questions, PMQs, select committees, debates"),
    ("3.4.3.6", "MPs and parliamentary roles", "the role of MPs: representing constituencies, debating, scrutinising legislation; Black Rod, the Speaker, whips, front and back benches"),
    ("3.4.3.7", "Making laws", "the legislative process: bills, readings, committee stage, royal assent; parliamentary debate of public issues"),
    ("3.4.3.8", "The Prime Minister, cabinet and government", "forming a government by the majority party or a coalition; the role and power of the Prime Minister, cabinet and ministers"),
    ("3.4.3.9", "The civil service and government departments", "government departments, ministries and agencies; the role of the civil service (impartial, anonymous, permanent)"),
    # 3.4.4 How do others govern themselves?
    ("3.4.4.1", "Politics beyond the UK", "how citizens can or cannot participate in politics in a democratic and a non-democratic system outside the UK: dictatorship, one-party state, theocracy, anarchy, absolute monarchy"),
    # 3.4.5 How can citizens try to bring about political change?
    ("3.4.5.1", "Digital democracy and political participation", "how digital democracy, social media and other measures improve voter engagement and political participation; how citizens contribute to parliamentary democracy"),
    # 3.5.1 Citizenship action: the actions of others (each theme's fifth key question)
    ("3.5.1.1", "Actions citizens can take", "actions to hold those in power to account or bring about change: joining an interest group or party, standing for election, campaigning, advocacy, lobbying, petitions, demonstrations, volunteering, direct action, boycotts"),
    ("3.5.1.2", "Pressure groups, charities and voluntary groups", "roles of public institutions, public services, interest and pressure groups, trade unions, charities and voluntary groups in providing a voice and support for groups in society"),
    ("3.5.1.3", "Using the media to bring about change", "how those who wish to bring about change use the media, including social media and celebrities"),
    ("3.5.1.4", "Citizens working together for change", "examples of citizens working together or through groups to change their communities: addressing public policy, challenging injustice, resolving a local issue"),
    # 3.5.2 The investigation: taking citizenship action
    ("3.5.2.1", "Choosing the issue and question", "stage 1: selecting a citizenship issue and constructing the investigation's question; local, national or global"),
    ("3.5.2.2", "Primary and secondary research", "stage 2: researching the issue using primary (surveys, interviews, questionnaires) and secondary sources; reliability of sources"),
    ("3.5.2.3", "Planning the action", "stage 3: planning the citizenship action from the research; aims, roles, timescales, working with others"),
    ("3.5.2.4", "Taking the action", "stage 4: taking informed action: letter writing, petitioning, e-media, volunteering, establishing a group; communicating with an audience"),
    ("3.5.2.5", "Evaluating the action", "stages 5 and 6: assessing the action's impact and success against its aims; evaluating the whole process, what went well and what could be done differently"),
]


def main():
    os.makedirs(WORK, exist_ok=True)
    sections = [{"code": c, "title": f"{c} {t}", "short": t} for c, t in SECTIONS]
    topics = [{"code": c, "ref": c, "title": t, "section": c[:3], "text": x, "year": 0} for c, t, x in TOPICS]
    assert len({t["code"] for t in topics}) == len(topics) and len({t["title"] for t in topics}) == len(topics)
    json.dump({"8100": {"sections": sections, "topics": topics}}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    for s in sections:
        print(s["title"], len([t for t in topics if t["section"] == s["code"]]), file=sys.stderr)
    print(f"{len(sections)} themes, {len(topics)} topics", file=sys.stderr)


if __name__ == "__main__":
    main()
