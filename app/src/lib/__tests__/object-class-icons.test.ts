import { describe, it, expect } from 'vitest';
import {
  PersonStanding, Car, Truck, Bus, Bike, Dog, Cat, Bird,
  Plane, TrainFront, Sailboat, PawPrint, Scissors, SearchCheck,
} from 'lucide-react';
import {
  getObjectClassIcon,
  hasObjectClassIcon,
  getObjectClassIconFromList,
} from '../object-class-icons';

describe('getObjectClassIcon', () => {
  it('returns PersonStanding for person', () => {
    expect(getObjectClassIcon('person')).toBe(PersonStanding);
  });

  it('returns Car for car', () => {
    expect(getObjectClassIcon('car')).toBe(Car);
  });

  it('returns Truck for truck', () => {
    expect(getObjectClassIcon('truck')).toBe(Truck);
  });

  it('returns Bus for bus', () => {
    expect(getObjectClassIcon('bus')).toBe(Bus);
  });

  it('returns Bike for bicycle', () => {
    expect(getObjectClassIcon('bicycle')).toBe(Bike);
  });

  it('returns Bike for motorcycle', () => {
    expect(getObjectClassIcon('motorcycle')).toBe(Bike);
  });

  it('returns Dog for dog', () => {
    expect(getObjectClassIcon('dog')).toBe(Dog);
  });

  it('returns Cat for cat', () => {
    expect(getObjectClassIcon('cat')).toBe(Cat);
  });

  it('returns Bird for bird', () => {
    expect(getObjectClassIcon('bird')).toBe(Bird);
  });

  it('returns Plane for airplane', () => {
    expect(getObjectClassIcon('airplane')).toBe(Plane);
  });

  it('returns TrainFront for train', () => {
    expect(getObjectClassIcon('train')).toBe(TrainFront);
  });

  it('returns Sailboat for boat', () => {
    expect(getObjectClassIcon('boat')).toBe(Sailboat);
  });

  it('returns PawPrint for unmapped animals', () => {
    expect(getObjectClassIcon('horse')).toBe(PawPrint);
    expect(getObjectClassIcon('bear')).toBe(PawPrint);
    expect(getObjectClassIcon('elephant')).toBe(PawPrint);
  });

  it('returns Scissors for scissors', () => {
    expect(getObjectClassIcon('scissors')).toBe(Scissors);
  });

  it('is case-insensitive', () => {
    expect(getObjectClassIcon('Car')).toBe(Car);
    expect(getObjectClassIcon('PERSON')).toBe(PersonStanding);
    expect(getObjectClassIcon('Truck')).toBe(Truck);
  });

  it('returns Tag fallback for unknown classes', () => {
    expect(getObjectClassIcon('unknown')).toBe(SearchCheck);
    expect(getObjectClassIcon('')).toBe(SearchCheck);
    expect(getObjectClassIcon('spaceship')).toBe(SearchCheck);
  });
});

describe('hasObjectClassIcon', () => {
  it('returns true for mapped classes', () => {
    expect(hasObjectClassIcon('person')).toBe(true);
    expect(hasObjectClassIcon('car')).toBe(true);
    expect(hasObjectClassIcon('dog')).toBe(true);
  });

  it('returns true case-insensitively', () => {
    expect(hasObjectClassIcon('Car')).toBe(true);
    expect(hasObjectClassIcon('PERSON')).toBe(true);
  });

  it('returns false for unknown classes', () => {
    expect(hasObjectClassIcon('unknown')).toBe(false);
    expect(hasObjectClassIcon('')).toBe(false);
  });
});

describe('getObjectClassIconFromList', () => {
  it('returns icon for single class', () => {
    expect(getObjectClassIconFromList('car')).toBe(Car);
  });

  it('returns icon for first class in comma-separated list', () => {
    expect(getObjectClassIconFromList('car,person')).toBe(Car);
    expect(getObjectClassIconFromList('truck,person')).toBe(Truck);
  });

  it('handles whitespace in list', () => {
    expect(getObjectClassIconFromList(' car , person ')).toBe(Car);
  });

  it('returns Tag fallback for empty string', () => {
    expect(getObjectClassIconFromList('')).toBe(SearchCheck);
  });
});
