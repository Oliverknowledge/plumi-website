# AQA A-Level German

`aqa_languages/tag_languages.py` tags AQA A-Level and AS German (7662, 7661) with no batches: nothing
goes to a model. `THEME` there holds each Paper 1 passage's sub-theme, placed by reading it, because
titles don't always say.

- **A passage has one sub-theme:** `family`, `digital`, `youth-culture`, `festivals`, `art`, `berlin`
  (Year 1, the only ones AS sets); `immigration`, `integration`, `racism`, `eu`, `politics-youth`,
  `reunification` (Year 2).
- **Close calls:** influencers, driverless cars and virtual museum visits are `digital`; a Berlin event
  that is mainly a festival (Karneval der Kulturen) is `festivals`; an exhibition on East Berlin is
  `berlin`; retiring to Austria ("Mehr Rente in Österreich") is `immigration`; music and television
  are `youth-culture`, unless the passage is about Berlin's music scene (`berlin`).
- **A literary extract has no theme:** it is `literary` instead.
- The skill is worked out from the wording and the recording, and Paper 2's essays from the work named
  in their heading.
