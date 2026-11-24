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
