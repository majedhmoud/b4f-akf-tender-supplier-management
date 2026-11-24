import type { Language } from '../generated/prisma/client.js';

// The placeholder the worker replaces with the real link at send time, so the
// stored email never contains a setup token (ENGINEERING_STANDARDS.md §2.1).
export const SETUP_LINK_PLACEHOLDER = '{{setupLink}}';

export interface RenderedEmail {
  subject: string;
  body: string;
}

// The account setup email, in the recipient's language at preparation time
// (ERD, Language). Plain text; no password is ever emailed.
export function accountSetupEmail(language: Language, name: string): RenderedEmail {
  if (language === 'ar') {
    return {
      subject: 'إعداد حسابك في منصة مناقصات مؤسسة الآغا خان',
      body: [
        `مرحبًا ${name}،`,
        '',
        'تم قبول تسجيلك كمورّد. عيّن كلمة المرور خلال 48 ساعة باستخدام هذا الرابط:',
        '',
        SETUP_LINK_PLACEHOLDER,
        '',
        'إذا انتهت صلاحية الرابط، افتحه واطلب رابطًا جديدًا.',
        '',
        'مؤسسة الآغا خان',
      ].join('\n'),
    };
  }
  return {
    subject: 'Set up your AKF Tenders account',
    body: [
      `Hello ${name},`,
      '',
      'Your supplier registration has been accepted. Set your password within 48 hours using this link:',
      '',
      SETUP_LINK_PLACEHOLDER,
      '',
      'If the link has expired, open it and ask for a new one.',
      '',
      'Aga Khan Foundation',
    ].join('\n'),
  };
}

// The account setup email for a new committee member (ERD, Committees).
export function committeeSetupEmail(language: Language, name: string): RenderedEmail {
  if (language === 'ar') {
    return {
      subject: 'إعداد حسابك في منصة مناقصات مؤسسة الآغا خان',
      body: [
        `مرحبًا ${name}،`,
        '',
        'تمت الموافقة على تعيينك عضوًا في لجنة مناقصة. عيّن كلمة المرور خلال 48 ساعة باستخدام هذا الرابط:',
        '',
        SETUP_LINK_PLACEHOLDER,
        '',
        'إذا انتهت صلاحية الرابط، افتحه واطلب رابطًا جديدًا.',
        '',
        'مؤسسة الآغا خان',
      ].join('\n'),
    };
  }
  return {
    subject: 'Set up your AKF Tenders account',
    body: [
      `Hello ${name},`,
      '',
      'You have been approved as a member of a tender committee. Set your password within 48 hours using this link:',
      '',
      SETUP_LINK_PLACEHOLDER,
      '',
      'If the link has expired, open it and ask for a new one.',
      '',
      'Aga Khan Foundation',
    ].join('\n'),
  };
}

// Award and cancellation drafts (WORKFLOWS.md, After the award). The officer
// reviews and edits them before sending. Bidders who did not win receive no
// scores and no details about the winning bid.
export type OfficerEmailKind = 'award_winner' | 'award_other' | 'cancellation';

export function officerEmailDraft(
  kind: OfficerEmailKind,
  language: Language,
  supplierName: string,
  tenderTitle: string,
): RenderedEmail {
  const ar = language === 'ar';
  const subjects: Record<OfficerEmailKind, [string, string]> = {
    award_winner: [`Tender awarded: ${tenderTitle}`, `ترسية المناقصة: ${tenderTitle}`],
    award_other: [`Tender result: ${tenderTitle}`, `نتيجة المناقصة: ${tenderTitle}`],
    cancellation: [`Tender cancelled: ${tenderTitle}`, `إلغاء المناقصة: ${tenderTitle}`],
  };
  const lines: Record<OfficerEmailKind, [string, string]> = {
    award_winner: [
      `We are pleased to inform you that your bid for "${tenderTitle}" has been selected. Our procurement team will contact you about the next steps.`,
      `يسرّنا إبلاغكم بأنه تم اختيار عرضكم في مناقصة "${tenderTitle}". سيتواصل معكم فريق المشتريات بشأن الخطوات التالية.`,
    ],
    award_other: [
      `Thank you for your bid for "${tenderTitle}". After evaluation, the tender has been awarded to another bidder.`,
      `نشكركم على تقديم عرضكم في مناقصة "${tenderTitle}". بعد التقييم، تمت ترسية المناقصة على مورّد آخر.`,
    ],
    cancellation: [
      `Thank you for your bid for "${tenderTitle}". The tender has been cancelled because no bid met its requirements.`,
      `نشكركم على تقديم عرضكم في مناقصة "${tenderTitle}". تم إلغاء المناقصة لعدم استيفاء أي عرض لمتطلباتها.`,
    ],
  };
  const i = ar ? 1 : 0;
  return {
    subject: subjects[kind][i],
    body: [
      ar ? `السادة ${supplierName}،` : `Dear ${supplierName},`,
      '',
      lines[kind][i],
      '',
      ar ? 'مؤسسة الآغا خان' : 'Aga Khan Foundation',
    ].join('\n'),
  };
}
