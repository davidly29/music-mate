import { TestBed } from '@angular/core/testing';
import { IdService } from './id.service';

describe('IdService', () => {
  let service: IdService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IdService);
  });

  it('generate() returns a non-empty string', () => {
    expect(service.generate()).toBeTruthy();
  });

  it('generate() returns unique values', () => {
    const ids = new Set(Array.from({ length: 20 }, () => service.generate()));
    expect(ids.size).toBe(20);
  });

  it('randomCode() returns 6-character uppercase string', () => {
    const code = service.randomCode();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('randomColor() cycles through palette without repeating in a single cycle', () => {
    const colors = Array.from({ length: 8 }, () => service.randomColor());
    expect(new Set(colors).size).toBe(8);
  });

  it('randomColor() wraps around after the full palette', () => {
    const first  = service.randomColor();
    for (let i = 0; i < 7; i++) service.randomColor(); // exhaust remaining 7
    const second = service.randomColor();
    expect(second).toBe(first);
  });

  it('initials() returns up to 2 uppercase letters', () => {
    expect(service.initials('Alice')).toBe('A');
    expect(service.initials('Alice Bob')).toBe('AB');
    expect(service.initials('Alice Bob Carol')).toBe('AB');
  });

  it('initials() handles extra whitespace', () => {
    expect(service.initials('  David  ')).toBe('D');
  });
});
