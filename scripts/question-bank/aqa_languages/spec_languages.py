"""The topics of AQA's A-Level French (7652) and Spanish (7692): the bank's topic tree.

Paper 1's reading, listening and translation passages are each set in one of the
specification's four themes, three sub-themes apiece: two themes are AS (Year 1, sat at AS
too), two A-Level only. Paper 2's essays are on a set text or a film, and a student
writes only on the works they studied, so, as with English Literature's set texts, each
work is a topic of its own (sections "Literary texts" and "Films"), with a pattern that
finds it in a question's heading. A work is listed only once AQA has set an essay on it.
"""

THEMES = {
    "french": [
        ("t1", "Aspects of French-speaking society: current trends", 1, [
            ("family", "The changing nature of family", "La famille en voie de changement"),
            ("cyber", "The cyber-society", "La cybersociété"),
            ("voluntary", "The place of voluntary work", "Le rôle du bénévolat"),
        ]),
        ("t2", "Artistic culture in the French-speaking world", 1, [
            ("heritage", "A culture proud of its heritage", "Une culture fière de son patrimoine"),
            ("music", "Contemporary francophone music", "La musique francophone contemporaine"),
            ("cinema", "Cinema: the seventh art form", "Cinéma : le septième art"),
        ]),
        ("t3", "Aspects of French-speaking society: current issues", 2, [
            ("diversity", "Positive features of a diverse society", "Les aspects positifs d'une société diverse"),
            ("marginalised", "Life for the marginalised", "Quelle vie pour les marginalisés ?"),
            ("criminals", "How criminals are treated", "Comment on traite les criminels"),
        ]),
        ("t4", "Aspects of political life in the French-speaking world", 2, [
            ("vote", "Teenagers, the right to vote and political commitment", "Les ados, le droit de vote et l'engagement politique"),
            ("strikes", "Demonstrations and strikes: who holds the power?", "Manifestations, grèves : à qui le pouvoir ?"),
            ("immigration", "Politics and immigration", "La politique et l'immigration"),
        ]),
    ],
    "spanish": [
        ("t1", "Aspects of Hispanic society", 1, [
            ("values", "Modern and traditional values", "Los valores tradicionales y modernos"),
            ("cyber", "Cyberspace", "El ciberespacio"),
            ("equality", "Equal rights", "La igualdad de los sexos"),
        ]),
        ("t2", "Artistic culture in the Hispanic world", 1, [
            ("idols", "Modern-day idols", "La influencia de los ídolos"),
            ("regional", "Spanish regional identity", "La identidad regional en España"),
            ("heritage", "Cultural heritage", "El patrimonio cultural"),
        ]),
        ("t3", "Multiculturalism in Hispanic society", 2, [
            ("immigration", "Immigration", "La inmigración"),
            ("racism", "Racism", "El racismo"),
            ("integration", "Integration", "La convivencia"),
        ]),
        ("t4", "Aspects of political life in the Hispanic world", 2, [
            ("youth", "Today's youth, tomorrow's citizens", "Jóvenes de hoy, ciudadanos del mañana"),
            ("monarchies", "Monarchies, republics and dictatorships", "Monarquías, repúblicas y dictaduras"),
            ("movements", "Popular movements", "Movimientos populares"),
        ]),
    ],
}

# Paper 2 (and AS Paper 2's Sections B and C): (section, title, [(code, title, pattern)]).
WORKS = {
    "french": [
        ("books", "Literary texts", [
            ("tartuffe", "Molière: Le Tartuffe", r"Tartuffe"),
            ("candide", "Voltaire: Candide", r"Candide"),
            ("boule-de-suif", "Guy de Maupassant: Boule de suif et autres contes de la guerre", r"Boule de Suif"),
            ("l-etranger", "Albert Camus: L’étranger", r"Camus"),
            ("bonjour-tristesse", "Françoise Sagan: Bonjour tristesse", r"Bonjour [Tt]ristesse"),
            ("elise", "Claire Etcherelli: Elise ou la vraie vie", r"Elise ou la vraie vie"),
            ("un-sac-de-billes", "Joseph Joffo: Un sac de billes", r"sac de billes"),
            ("kiffe-kiffe-demain", "Faïza Guène: Kiffe kiffe demain", r"Kiffe kiffe"),
            ("un-secret", "Philippe Grimbert: Un secret", r"Grimbert"),
            ("no-et-moi", "Delphine de Vigan: No et moi", r"No et moi"),
        ]),
        ("films", "Films", [
            ("les-400-coups", "François Truffaut: Les 400 coups", r"400 coups"),
            ("au-revoir-les-enfants", "Louis Malle: Au revoir les enfants", r"Au revoir les enfants"),
            ("la-haine", "Mathieu Kassovitz: La haine", r"La Haine"),
            ("l-auberge-espagnole", "Cédric Klapisch: L’auberge espagnole", r"auberge espagnole"),
            ("un-long-dimanche", "Jean-Pierre Jeunet: Un long dimanche de fiançailles", r"long dimanche"),
            ("entre-les-murs", "Laurent Cantet: Entre les murs", r"Entre les murs"),
        ]),
    ],
    "spanish": [
        ("books", "Literary texts", [
            ("la-casa-de-bernarda-alba", "Federico García Lorca: La casa de Bernarda Alba", r"Bernarda Alba"),
            ("rimas", "Gustavo Adolfo Bécquer: Rimas", r"Rimas"),
            ("requiem", "Ramón J. Sender: Réquiem por un campesino español", r"Réquiem"),
            ("el-coronel", "Gabriel García Márquez: El coronel no tiene quien le escriba", r"El coronel no tiene"),
            ("cronica", "Gabriel García Márquez: Crónica de una muerte anunciada", r"Crónica de una muerte"),
            ("como-agua-para-chocolate", "Laura Esquivel: Como agua para chocolate", r"Como agua para chocolate"),
            ("el-otro-arbol-de-guernica", "Luis de Castresana: El otro árbol de Guernica", r"árbol de Guernica"),
            ("la-casa-de-los-espiritus", "Isabel Allende: La casa de los espíritus", r"casa de los espíritus"),
            ("la-sombra-del-viento", "Carlos Ruiz Zafón: La sombra del viento", r"sombra del viento"),
            ("las-bicicletas", "Fernando Fernán-Gómez: Las bicicletas son para el verano", r"bicicletas son para el verano"),
        ]),
        ("films", "Films", [
            ("abel", "Diego Luna: Abel", r"Abel\b"),
            ("el-laberinto-del-fauno", "Guillermo del Toro: El laberinto del fauno", r"laberinto del fauno"),
            ("las-13-rosas", "Emilio Martínez-Lázaro: Las 13 rosas", r"13 rosas"),
            ("maria-llena-eres-de-gracia", "Joshua Marston: María, llena eres de gracia", r"llena eres de gracia"),
            ("ocho-apellidos-vascos", "Emilio Martínez-Lázaro: Ocho apellidos vascos", r"Ocho apellidos vascos"),
            ("volver", "Pedro Almodóvar: Volver", r"Volver\b"),
        ]),
    ],
}
