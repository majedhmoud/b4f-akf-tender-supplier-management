import { createServer, type Server, type Socket } from 'node:net';

// A tiny SMTP server for the failure cases Mailpit cannot produce.
// - `busy`: answers 421 at greeting (a confirmed, temporary refusal).
// - `reject`: answers 550 to RCPT TO (a confirmed, permanent refusal).
// - `drop`: takes the whole message, then closes without replying, so the
//   client cannot tell whether it was accepted.
// - `accept`: takes the message and keeps it in `received`.
export type FakeSmtpMode = 'busy' | 'reject' | 'drop' | 'accept';

export class FakeSmtp {
  mode: FakeSmtpMode = 'busy';
  connections = 0;
  readonly received: string[] = [];
  private readonly server: Server = createServer((socket) => this.serve(socket));

  async listen(): Promise<number> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    const address = this.server.address();
    if (!address || typeof address === 'string') throw new Error('No port');
    return address.port;
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private serve(socket: Socket): void {
    this.connections += 1;
    if (this.mode === 'busy') {
      socket.end('421 Service not available\r\n');
      return;
    }
    let inData = false;
    let buffer = '';
    socket.write('220 fake ESMTP\r\n');
    socket.on('error', () => undefined);
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      if (inData) {
        const dataEnd = buffer.indexOf('\r\n.\r\n');
        if (dataEnd < 0) return;
        if (this.mode !== 'accept') {
          socket.destroy();
          return;
        }
        this.received.push(buffer.slice(0, dataEnd));
        buffer = buffer.slice(dataEnd + 5);
        inData = false;
        socket.write('250 Queued\r\n');
      }
      let end: number;
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end).toUpperCase();
        buffer = buffer.slice(end + 2);
        if (line.startsWith('EHLO') || line.startsWith('HELO')) socket.write('250 fake\r\n');
        else if (line.startsWith('MAIL')) socket.write('250 OK\r\n');
        else if (line.startsWith('RCPT')) {
          socket.write(this.mode === 'reject' ? '550 No such user\r\n' : '250 OK\r\n');
        } else if (line.startsWith('DATA')) {
          inData = true;
          socket.write('354 Go ahead\r\n');
          return;
        } else if (line.startsWith('QUIT')) socket.end('221 Bye\r\n');
        else if (line.startsWith('RSET')) socket.write('250 OK\r\n');
        else socket.write('502 Not implemented\r\n');
      }
    });
  }
}
