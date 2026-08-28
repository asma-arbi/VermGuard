import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connecté : ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client déconnecté : ${client.id}`);
  }

  /**
   * Méthode pour envoyer les tickets mis à jour à tous les clients connectés
   */
  emitJiraUpdate(team: 'soc' | 'support', tickets: any) {
    this.server.emit('jira_tickets_updated', { team, tickets });
    this.logger.log(`Événement jira_tickets_updated émis pour l'équipe ${team}`);
  }

  /**
   * Méthode pour envoyer une notification lorsqu'une évaluation est créée ou mise à jour par le manager
   */
  emitEvaluationUpdate(data: { userId: number; userEmail?: string; userName: string; period: string; globalScore: number; isPublished: boolean }) {
    this.server.emit('evaluation_updated', data);
    this.logger.log(`Événement evaluation_updated émis pour l'utilisateur ID ${data.userId} (${data.userEmail})`);
  }
}
