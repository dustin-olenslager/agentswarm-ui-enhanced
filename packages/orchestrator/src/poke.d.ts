declare module "poke" {
  export class Poke {
    sendMessage(text: string): Promise<unknown>;
  }
}
