export type HeliosThemeId = 'sakura' | 'nord' | 'lavender' | 'obsidian';

export interface HeliosThemeOption {
  id: HeliosThemeId;
  name: string;
  swatch: string;
  description: string;
}

export type ActiveTab =
  | 'dashboard'
  | 'smart-search'
  | 'lecture-sync'
  | 'data-storyteller'
  | 'brain-map'
  | 'quiz-master'
  | 'library'
  | 'saved-notes'
  | 'memory-spark';

export interface DocumentPage {
  pageNumber: number;
  title: string;
  content: string;
}

export interface StudyDocument {
  id: string;
  title: string;
  fileName: string;
  courseCode: string;
  courseName: string;
  masteryPercent: number;
  lastChapter: string;
  pages: DocumentPage[];
  suggestedQuestions: string[];
  source: 'preloaded' | 'uploaded';
  uploadedAt: string;
}

export interface CitationExcerpt {
  id: string;
  documentId?: string;
  fileName?: string;
  documentTitle?: string;
  pageNumber: number;
  sectionTitle: string;
  excerpt: string;
  whyRelevant: string;
}

export type AnswerMode = 'direct' | 'deep' | 'exam';

export interface QAMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  answerMode?: AnswerMode;
  citations?: CitationExcerpt[];
  followUpQuestions?: string[];
  foundInDocument?: boolean;
  error?: string;
}

export interface SavedNote {
  id: string;
  documentId: string;
  documentTitle: string;
  question: string;
  answer: string;
  citations: CitationExcerpt[];
  savedAt: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  timeLabel: string;
  kind: 'search' | 'upload' | 'note' | 'spark';
  documentId?: string;
  pageNumber?: number;
}

export type BrainNodeKind = 'document' | 'bridge' | 'concept';

export interface BrainNodeSource {
  documentId: string;
  fileName: string;
  pageNumber: number;
}

export interface BrainNode {
  id: string;
  label: string;
  kind: BrainNodeKind;
  summary: string;
  sources: BrainNodeSource[];
}

export interface BrainTriple {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  documentId?: string;
  fileName?: string;
  pageNumber?: number;
}

export interface BrainGraphData {
  nodes: BrainNode[];
  triples: BrainTriple[];
  focusTopic: string;
  generatedAt: string;
}

export interface LectureSegment {
  id: string;
  timestamp: string;
  seconds: number;
  topic: string;
  text: string;
  isKeyMoment: boolean;
}

export interface LectureRecord {
  id: string;
  title: string;
  fileName: string;
  courseCode: string;
  durationLabel: string;
  summary: string;
  takeaways: string[];
  segments: LectureSegment[];
  audioUrl?: string;
  createdAt: string;
}

export interface LectureSearchCitation {
  timestamp: string;
  seconds: number;
  topic: string;
  quote: string;
  whyRelevant: string;
}

export type ChartKind = 'bar' | 'line' | 'scatter';

export interface DataColumnStat {
  name: string;
  type: 'numeric' | 'categorical';
  missingCount: number;
  min?: number;
  max?: number;
  mean?: number;
}

export interface DataCleaningReport {
  rowsRaw: number;
  rowsCleaned: number;
  missingHandled: number;
  duplicatesRemoved: number;
  unitsNormalized: number;
}

export interface DataStoryChapter {
  tag: string;
  heading: string;
  narrative: string;
  highlightRowIndex?: number;
}

export interface DataStoryDataset {
  id: string;
  title: string;
  fileName: string;
  headline?: string;
  columns: string[];
  columnStats: DataColumnStat[];
  rows: Array<Record<string, string | number | null>>;
  cleaningReport: DataCleaningReport;
  recommendedChart: {
    type: ChartKind;
    xKey: string;
    yKey: string;
  };
  aiSummary: string;
  keyFindings: string[];
  storyChapters?: DataStoryChapter[];
  createdAt: string;
}

export type QuizMode = 'mcq' | 'flashcards' | 'short-answer';
export type QuizDifficulty = 'foundational' | 'exam';

export interface QuizMCQItem {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  pageNumber: number;
}

export interface QuizFlashcardItem {
  id: string;
  front: string;
  back: string;
  hint: string;
  pageNumber: number;
}

export interface QuizShortAnswerItem {
  id: string;
  question: string;
  sampleAnswer: string;
  rubricKeywords: string[];
  pageNumber: number;
}

export interface QuizGeneratedSet {
  mode: QuizMode;
  difficulty: QuizDifficulty;
  documentId: string;
  documentTitle: string;
  mcqItems?: QuizMCQItem[];
  flashcards?: QuizFlashcardItem[];
  shortAnswerItems?: QuizShortAnswerItem[];
}
