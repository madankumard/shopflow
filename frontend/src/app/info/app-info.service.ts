import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface AppInfo {
  environment: string;
  version: string;
}

@Injectable({ providedIn: 'root' })
export class AppInfoService {
  private readonly http = inject(HttpClient);

  get(): Observable<AppInfo> {
    return this.http.get<AppInfo>('/api/info');
  }
}
