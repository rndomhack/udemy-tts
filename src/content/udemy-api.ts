import { UDEMY_LOCALE_MAP } from '../lib/constants';
import { createLogger } from '../lib/logger';

// Udemy の API からコース情報・レクチャー情報・字幕 VTT を取得する。
// タイトルや言語は構造変更に弱い DOM ではなく API から取り、ログイン Cookie を付けて呼ぶ。

const log = createLogger('udemy-api');

export function getLectureId(): string | null {
  const m = location.pathname.match(/\/learn\/lecture\/(\d+)/);
  return m ? m[1] : null;
}

export function getCourseId(): string | null {
  try {
    const el = document.querySelector<HTMLElement>("[data-module-id='course-taking']");
    if (!el) return null;
    const args = JSON.parse(el.dataset.moduleArgs ?? '{}') as { courseId?: number | string };
    return args.courseId ? String(args.courseId) : null;
  } catch {
    return null;
  }
}

export interface CourseInfo {
  title: string;
  locale: string;
}

export async function fetchCourseInfo(courseId: string): Promise<CourseInfo> {
  const url = `${location.origin}/api-2.0/courses/${courseId}/?fields[course]=title,locale`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Udemy course API error: ${res.status}`);
  const data = (await res.json()) as {
    title?: string;
    locale?: { locale?: string };
  };
  const info = { title: data.title ?? '', locale: data.locale?.locale ?? '' };
  log.debug(`course info: title="${info.title}" locale=${info.locale}`);
  return info;
}

export interface CaptionRef {
  locale_id: string;
  url: string;
}

export interface LectureData {
  title: string;
  captions: CaptionRef[];
}

export async function fetchLectureData(
  courseId: string,
  lectureId: string,
): Promise<LectureData> {
  const url =
    `${location.origin}/api-2.0/users/me/subscribed-courses/${courseId}` +
    `/lectures/${lectureId}/?fields[asset]=captions`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Udemy lecture API error: ${res.status}`);
  const data = (await res.json()) as {
    title?: string;
    asset?: { captions?: CaptionRef[] };
  };
  const lecture = { title: data.title ?? '', captions: data.asset?.captions ?? [] };
  log.debug(
    `lecture: title="${lecture.title}" captions=[${lecture.captions.map((c) => c.locale_id).join(', ')}]`,
  );
  return lecture;
}

export async function fetchVttText(caption: CaptionRef): Promise<string> {
  const res = await fetch(caption.url);
  if (!res.ok) throw new Error(`VTT fetch error: ${res.status}`);
  return res.text();
}

/** 指定ロケールの字幕を選ぶ。完全一致が無ければ言語部分の前方一致で代替する */
export function pickCaption(captions: CaptionRef[], locale: string): CaptionRef {
  const exact = captions.find((c) => c.locale_id === locale);
  if (exact) return exact;
  const lang = locale.split(/[-_]/)[0].toLowerCase();
  const prefix = captions.find((c) => c.locale_id.toLowerCase().startsWith(`${lang}_`));
  if (prefix) return prefix;
  throw new Error(
    `No caption for locale ${locale} (available: ${captions.map((c) => c.locale_id).join(', ') || 'none'})`,
  );
}

export function toLocaleId(lang: string): string {
  return UDEMY_LOCALE_MAP[lang] ?? lang;
}

export function localeToLang(locale: string): string {
  return locale.split(/[-_]/)[0].toLowerCase();
}
