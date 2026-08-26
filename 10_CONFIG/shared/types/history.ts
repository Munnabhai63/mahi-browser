export interface HistoryItem {
  id: string;
  profileId: string;
  url: string;
  title: string;
  visitCount: number;
  lastVisitTime: string;
  typedCount?: number;
}

export interface HistoryFilterOptions {
  profileId: string;
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'visitTime' | 'visitCount' | 'title' | 'domain';
  sortDirection?: 'asc' | 'desc';
}
