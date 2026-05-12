import { useEffect } from 'react';

const SITE_NAME = 'prmd.ai';

export function useTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    const alreadyBranded = title === SITE_NAME || title.toLowerCase().includes(SITE_NAME.toLowerCase());
    document.title = alreadyBranded ? title : `${title} · ${SITE_NAME}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export function useMetaDescription(description: string): void {
  useEffect(() => {
    const tag = document.querySelector('meta[name="description"]');
    if (!tag) return;
    const previous = tag.getAttribute('content');
    tag.setAttribute('content', description);
    return () => {
      if (previous !== null) tag.setAttribute('content', previous);
    };
  }, [description]);
}
