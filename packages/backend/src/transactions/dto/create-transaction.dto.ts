export class CreateTransactionDto {
    readonly amount!: number;
    readonly description!: string;
    readonly date!: Date;
    readonly category!: string;
}
