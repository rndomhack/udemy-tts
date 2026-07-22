/* 指定した語を読み替え後の文字列に置換する */
export class WordSubstituter {
  private readonly patterns: Array<[RegExp, string]>;

  constructor(patterns: Array<[RegExp, string]> = []) {
    this.patterns = patterns;
  }

  static fromDict(dict: Record<string, string>): WordSubstituter {
    // 短い語が長い語の一部を先に置換してしまうのを防ぐため、長い語から順に適用する
    const patterns: Array<[RegExp, string]> = Object.keys(dict)
      .sort((a, b) => b.length - a.length)
      .filter((word) => dict[word])
      .map((word) => [new RegExp(escapeRegExp(word), 'gi'), dict[word]]);
    return new WordSubstituter(patterns);
  }

  substitute(text: string): string {
    for (const [pattern, reading] of this.patterns) {
      text = text.replace(pattern, reading);
    }
    return text;
  }

  merge(other: WordSubstituter): WordSubstituter {
    return new WordSubstituter([...this.patterns, ...other.patterns]);
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
