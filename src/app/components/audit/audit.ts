import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditService, AuditLog } from '../../services/audit.service';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './audit.html',
  styleUrl: './audit.css'
})
export class AuditComponent implements OnInit {
  logs: AuditLog[] = [];
  isLoading = true;
  errorMessage = '';

  constructor(private auditService: AuditService) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    const cacheKey = 'vermeg_audit_logs_cache';
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.logs = parsed;
          this.isLoading = false;
        }
      } catch (e) {}
    }

    this.auditService.getLogs().subscribe({
      next: (data) => {
        this.logs = data;
        this.isLoading = false;
        try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
      },
      error: (err) => {
        console.error(err);
        if (!cached) this.errorMessage = 'Failed to load audit logs.';
        this.isLoading = false;
      }
    });
  }
}
