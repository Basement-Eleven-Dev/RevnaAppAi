import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Telaio del backoffice: barra laterale fissa a sinistra, pagina a destra.
 *
 * È un layout di rotta, non un componente da includere in ogni pagina: le rotte
 * riservate ai referenti Revna sono figlie di questa, e la pagina compare qui
 * dentro nel `<router-outlet>`. Così la navigazione non si smonta e non si
 * rimonta a ogni cambio di sezione, e le pagine non devono più ricordarsi di
 * mettere la barra in cima.
 *
 * Le sottosezioni dell'assistente stanno nell'albero della barra invece che in
 * una fila di linguette dentro la pagina: sono tre pagine dello stesso lavoro, e
 * averle sempre sott'occhio evita il rimbalzo «entra nella sezione per scoprire
 * cosa contiene».
 */
@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
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
