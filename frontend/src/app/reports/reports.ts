import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Report, ReportService } from './report.service';

/** Sales and stock at a glance, for admins. */
@Component({
  selector: 'app-reports',
  imports: [CurrencyPipe, DatePipe, DecimalPipe],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports implements OnInit {
  private readonly reportService = inject(ReportService);

  protected readonly report = signal<Report | null>(null);
  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');

  /** The best day's revenue, which the daily bars are drawn against. */
  protected readonly busiestDay = computed(() =>
    Math.max(0, ...(this.report()?.daily.map((day) => day.revenue) ?? [])),
  );

  ngOnInit(): void {
    this.reportService.get().subscribe({
      next: (report) => {
        this.report.set(report);
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  /** A day's bar as a percentage of the busiest day's. */
  protected barWidth(revenue: number): number {
    const busiest = this.busiestDay();
    return busiest > 0 ? Math.round((revenue / busiest) * 100) : 0;
  }
}
