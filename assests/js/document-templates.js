(function () {
  "use strict";

  function line(value, fallback) { return value || fallback; }

  window.LgndryDocumentTemplates = function (type, c) {
    var common = {
      date: line(c.date, "[EFFECTIVE DATE]"), client: line(c.client, "[CLIENT NAME]"), contact: line(c.contact, "[CLIENT CONTACT PERSON]"),
      email: line(c.email, "[CLIENT EMAIL]"), phone: line(c.phone, "[CLIENT PHONE]"), project: line(c.project, "[PROJECT / BOOKING / PARTNERSHIP NAME]"),
      scope: line(c.scope, "[SCOPE OF WORK]"), deliverables: line(c.deliverables, "[DELIVERABLES]"), timeline: line(c.timeline, "[TIMELINE]"),
      location: line(c.location, "[LOCATION]"), callTime: line(c.callTime, "[CALL TIME]"), wrapTime: line(c.wrapTime, "[ESTIMATED WRAP TIME]"),
      fees: line(c.fees, "[TOTAL FEES]"), payment: line(c.payment, "[PAYMENT SCHEDULE AND TERMS]")
    };
    c = common;
    var templates = {
      "Contract": `PHOTOGRAPHY & CREATIVE SERVICES AGREEMENT

Effective date: ${c.date}

PARTIES
This agreement is between LGNDRY.Co (the "Studio"), represented by Dan Mokgwadi, Founder & Creative Director, and ${c.client} (the "Client"), represented by ${c.contact}.
Client contact: ${c.email} | ${c.phone}

1. PROJECT
${c.project}

2. SCOPE OF WORK
${c.scope}

3. DELIVERABLES
${c.deliverables}

4. TIMELINE
${c.timeline}

5. FEES AND PAYMENT
Total professional fees: ${c.fees}
${c.payment}
Additional work outside the agreed scope requires written approval and may be billed separately.

6. CLIENT RESPONSIBILITIES
The Client will provide timely access, approvals, accurate information, brand assets, locations, products, and personnel reasonably required to complete the work.

7. USAGE AND INTELLECTUAL PROPERTY
Upon full payment, the Client receives the usage rights expressly agreed for the deliverables. The Studio retains copyright unless a written assignment states otherwise and may display the work in its portfolio unless confidentiality is agreed in writing.

8. CANCELLATION AND RESCHEDULING
[CANCELLATION, POSTPONEMENT, AND RESCHEDULING TERMS]

9. LIABILITY
Each party will act reasonably to limit loss. The Studio's aggregate liability will not exceed fees paid under this agreement, except where the law does not permit such limitation.

10. GENERAL
Changes must be agreed in writing. This agreement is governed by the laws of South Africa.

SIGNED FOR THE CLIENT
Name: ${c.contact}
Title: [TITLE]
Signature: ____________________
Date: ____________________

SIGNED FOR LGNDRY.CO
Name: Dan Mokgwadi
Title: Founder & Creative Director
Signature: ____________________
Date: ____________________`,
      "NDA": `MUTUAL NON-DISCLOSURE AGREEMENT

Effective date: ${c.date}

This agreement is between LGNDRY.Co, represented by Dan Mokgwadi, and ${c.client}, represented by ${c.contact}.

1. PURPOSE
The parties wish to discuss and work on ${c.project}. Confidential information may be shared solely for evaluating, planning, or delivering this work.

2. CONFIDENTIAL INFORMATION
Confidential Information includes business plans, concepts, treatments, creative materials, pricing, client information, technical information, unpublished imagery, and information identified as confidential.

3. OBLIGATIONS
Each receiving party will protect Confidential Information with reasonable care, use it only for the Purpose, and disclose it only to people who need it and are bound by confidentiality obligations.

4. EXCLUSIONS
Confidential Information excludes information independently developed, lawfully received without restriction, publicly available through no breach, or required to be disclosed by law after reasonable notice.

5. OWNERSHIP
No intellectual-property rights are transferred by this agreement.

6. TERM
These obligations continue for [NUMBER] years from the Effective Date, except for trade secrets protected for as long as they remain trade secrets.

7. RETURN OR DELETION
On request, each party will return or securely delete Confidential Information, subject to lawful record-retention requirements.

8. GOVERNING LAW
This agreement is governed by the laws of South Africa.

CLIENT
Name: ${c.contact}
Company: ${c.client}
Signature: ____________________  Date: __________

LGNDRY.CO
Name: Dan Mokgwadi
Signature: ____________________  Date: __________`,
      "Proposal": `CREATIVE SERVICES PROPOSAL

Prepared for: ${c.client}
Contact: ${c.contact} | ${c.email} | ${c.phone}
Prepared by: Dan Mokgwadi, Founder & Creative Director
Date: ${c.date}
Proposal valid until: [EXPIRY DATE]

PROJECT
${c.project}

OBJECTIVE
${c.scope}

CREATIVE APPROACH
[CREATIVE DIRECTION, VISUAL LANGUAGE, AND PRODUCTION APPROACH]

SCOPE OF WORK
[PRE-PRODUCTION, PRODUCTION, AND POST-PRODUCTION SERVICES]

DELIVERABLES
${c.deliverables}

TIMELINE
${c.timeline}

INVESTMENT
Professional fees: ${c.fees}
Payment terms: ${c.payment}
Exclusions / additional costs: [TRAVEL, TALENT, LOCATION, EQUIPMENT, LICENSING, TAXES]

CLIENT INPUTS AND APPROVALS
[REQUIRED ASSETS, DECISION-MAKERS, REVIEW ROUNDS, AND APPROVAL DEADLINES]

NEXT STEPS
1. Approve this proposal in writing.
2. Sign the services agreement.
3. Pay the required deposit.
4. Confirm the production schedule.

ACCEPTED BY
Name: ${c.contact}
Title: [TITLE]
Signature: ____________________
Date: ____________________`,
      "Creative Brief": `CREATIVE BRIEF

Project: ${c.project}
Client: ${c.client}
Primary contact: ${c.contact} | ${c.email} | ${c.phone}
Brief date: ${c.date}

1. BACKGROUND
[BRAND, CAMPAIGN, OR PROJECT CONTEXT]

2. BUSINESS OBJECTIVE
${c.scope}

3. TARGET AUDIENCE
[PRIMARY AND SECONDARY AUDIENCES]

4. SINGLE-MINDED MESSAGE
[THE ONE THING THE AUDIENCE SHOULD THINK, FEEL, OR DO]

5. CREATIVE DIRECTION
[TONE, MOOD, VISUAL REFERENCES, COLOUR, COMPOSITION, AND BRAND REQUIREMENTS]

6. SCOPE AND DELIVERABLES
${c.deliverables}

7. CHANNELS AND FORMATS
[WEBSITE, SOCIAL, PRINT, CAMPAIGN, EDITORIAL, INTERNAL]

8. TIMELINE AND MILESTONES
${c.timeline}

9. BUDGET
${c.fees}

10. MANDATORIES AND RESTRICTIONS
[LOGOS, COPY, LEGAL LINES, USAGE, ACCESSIBILITY, AND ITEMS TO AVOID]

11. STAKEHOLDERS AND APPROVALS
Final approver: [NAME AND ROLE]
Feedback process: [PROCESS AND NUMBER OF REVIEW ROUNDS]

12. SUCCESS MEASURES
[HOW THE WORK WILL BE EVALUATED]`,
      "Call Sheet": `PRODUCTION CALL SHEET

Production: ${c.project}
Client: ${c.client}
Shoot date: ${c.timeline}
Location: ${c.location}
General call time: ${c.callTime}
Estimated wrap: ${c.wrapTime}

KEY CONTACTS
Producer / photographer: Dan Mokgwadi | neomokgwadi@lgndry-co.co.za
Client contact: ${c.contact} | ${c.email} | ${c.phone}
Emergency contact: [NAME AND NUMBER]

LOCATION DETAILS
Address: ${c.location}
Parking / access: [INSTRUCTIONS]
Location contact: [NAME AND NUMBER]
Nearest hospital / emergency services: [DETAILS]

SCHEDULE
${c.callTime} - Crew call / setup
[TIME] - Client / talent arrival
[TIME] - Shoot block 1
[TIME] - Break
[TIME] - Shoot block 2
${c.wrapTime} - Wrap / strike

CREW
[NAME - ROLE - MOBILE NUMBER]

TALENT / SUBJECTS
[NAME - ROLE - CALL TIME - CONTACT]

SHOT PRIORITIES
${c.deliverables}

WARDROBE / HAIR / MAKEUP / PROPS
[REQUIREMENTS]

EQUIPMENT AND PRODUCTION NOTES
[EQUIPMENT, POWER, WEATHER PLAN, CATERING, ACCESSIBILITY, AND SAFETY NOTES]

CONFIDENTIAL - FOR PRODUCTION USE ONLY`,
      "Model Release": `MODEL RELEASE

Project: ${c.project}
Production date: ${c.timeline}
Photographer / Producer: Dan Mokgwadi, LGNDRY.Co
Client: ${c.client}

MODEL DETAILS
Full legal name: [MODEL FULL NAME]
Identity / passport number: [ID NUMBER]
Address: [ADDRESS]
Email: [EMAIL]
Phone: [PHONE]
Date of birth: [DATE OF BIRTH]
Guardian name (if under 18): [PARENT / GUARDIAN NAME]

CONSENT AND GRANT
I authorise LGNDRY.Co and the Client, together with their authorised licensees, to photograph and/or record me and to edit, reproduce, publish, display, distribute, and use the resulting material for these agreed purposes: [CAMPAIGN / EDITORIAL / WEBSITE / SOCIAL / INTERNAL / OTHER].

Territory: [TERRITORY]
Media: [MEDIA]
Usage period: [PERIOD]
Exclusivity / restrictions: [DETAILS]
Credit: [CREDIT REQUIREMENT]
Compensation: [FEE / VALUE / NO FEE]

I confirm that I have authority to grant this permission and understand that approved edits may be made, provided the material is not used unlawfully or in a defamatory manner.

MODEL
Name: [MODEL FULL NAME]
Signature: ____________________
Date: ____________________

PARENT / GUARDIAN (IF REQUIRED)
Name: [NAME]
Signature: ____________________
Date: ____________________

WITNESS / PRODUCER
Name: Dan Mokgwadi
Signature: ____________________
Date: ____________________`,
      "Location Release": `LOCATION RELEASE

Project: ${c.project}
Production date(s): ${c.timeline}
Producer: Dan Mokgwadi, LGNDRY.Co
Client: ${c.client}

LOCATION
Property / location name: [LOCATION NAME]
Physical address: ${c.location}
Owner / authorised representative: [FULL NAME]
Company (if applicable): [COMPANY]
Email: [EMAIL]
Phone: [PHONE]

PERMISSION
The undersigned grants LGNDRY.Co, the Client, and their authorised crew permission to enter and use the Location for photography, filming, sound recording, staging, and related production activities for the Project.

ACCESS PERIOD
From: [DATE AND TIME]
To: [DATE AND TIME]
Permitted areas: [AREAS]
Restricted areas: [AREAS]

USE OF MATERIAL
The resulting photographs and recordings may be edited, reproduced, published, displayed, distributed, and used in the agreed media, territory, and period: [USAGE DETAILS].

FEES AND CONDITIONS
Location fee: [AMOUNT / NO FEE]
Payment terms: [TERMS]
Deposit / damages: [DETAILS]
Power, parking, security, cleaning, noise, and access conditions: [DETAILS]

The Producer will take reasonable care of the Location and report material damage caused directly by the production. The owner confirms authority to grant this permission.

OWNER / AUTHORISED REPRESENTATIVE
Name: [FULL NAME]
Title: [TITLE]
Signature: ____________________
Date: ____________________

FOR LGNDRY.CO
Name: Dan Mokgwadi
Signature: ____________________
Date: ____________________`
    };
    return templates[type] || "";
  };
}());
