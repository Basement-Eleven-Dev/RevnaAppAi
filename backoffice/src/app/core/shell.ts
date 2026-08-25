import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from './auth.service';

/** Barra superiore condivisa dalle pagine del backoffice. */
@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="topbar">
      <img class="logo" src="brand/logo_dark.svg" alt="Revna" />
      <nav>
        <a routerLink="/utenti" routerLinkActive="active">Nuova utenza</a>
        <a routerLink="/clienti" routerLinkActive="active">Clienti</a>
      </nav>
      <div class="spacer"></div>
      <span class="who">{{ operatore()?.email }}</span>
      <button type="button" class="ghost" (click)="logout()">Esci</button>
    </header>
  `,
  styles: `
    .topbar {
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 16px 24px;
      border-bottom: 1px solid var(--border);
    }
    .logo { width: 110px; }
    nav { display: flex; gap: 16px; }
    nav a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding-bottom: 2px;
      border-bottom: 2px solid transparent;
    }
    nav a.active { color: var(--text); border-bottom-color: var(--brand); }
    .spacer { flex: 1; }
    .who { color: var(--text-muted); font-size: 14px; }
  `,
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly operatore = this.auth.user;

  protected async logout(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/login']);
  }
}
