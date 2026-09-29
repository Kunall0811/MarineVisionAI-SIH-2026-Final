import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'ws';
import * as http from 'http';
import { URL } from 'url';
import * as jwt from 'jsonwebtoken';

/**
 * Real-time event bus for MarineVision AI.
 *
 * Emits the exact event catalogue required by the spec:
 * survey_started, survey_updated, sonar_uploaded, processing_started,
 * processing_progress, detection_created, detection_updated,
 * verification_completed, report_generated, email_sent, alert_created.
 *
 * Clients connect to ws://<host>/api/realtime?token=<JWT access token>.
 * Unauthenticated sockets are closed immediately - this is not a public feed.
 */
@Injectable()
@WebSocketGateway({ path: '/api/realtime' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('RealtimeGateway');
  private clients = new Map<any, { userId: string; role: string }>();

  handleConnection(client: any, request: http.IncomingMessage) {
    try {
      const url = new URL(request.url || '', 'http://localhost');
      const token = url.searchParams.get('token');
      if (!token) throw new Error('missing token');
      const secret = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';
      const payload: any = jwt.verify(token, secret);
      this.clients.set(client, { userId: payload.sub, role: payload.role });
      client.send(JSON.stringify({ event: 'connected', data: { ok: true } }));
    } catch (err) {
      this.logger.warn('Rejected unauthenticated websocket connection.');
      client.close(4001, 'Unauthorized');
    }
  }

  handleDisconnect(client: any) {
    this.clients.delete(client);
  }

  /** Broadcast an event to every connected, authenticated client. */
  emitEvent(event: string, data: Record<string, any>, restrictToRole?: 'ADMIN' | 'OPERATOR') {
    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    for (const [client, meta] of this.clients.entries()) {
      if (restrictToRole && meta.role !== restrictToRole) continue;
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  }
}
