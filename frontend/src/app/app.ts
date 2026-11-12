import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';
import { AppInfo, AppInfoService } from './info/app-info.service';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly appInfoService = inject(AppInfoService);
  protected readonly auth = inject(AuthService);

  /** Stays null while loading or if the API is unreachable; the badge is simply not shown. */
  protected readonly info = signal<AppInfo | null>(null);

  ngOnInit(): void {
    this.appInfoService.get().subscribe({
      next: (info) => this.info.set(info),
      error: () => this.info.set(null),
    });
  }
}
