import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A guest. The same person can write by email one day and by WhatsApp the next:
 * the customer is matched on email or phone so both conversations land on one record.
 */
@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  name: string | null;

  @Column({ type: 'text', nullable: true, unique: true })
  email: string | null;

  /** E.164 format, e.g. +33612345678. */
  @Column({ type: 'text', nullable: true, unique: true })
  phone: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
