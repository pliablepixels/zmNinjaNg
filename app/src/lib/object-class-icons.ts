/**
 * Object detection class icon mapping.
 *
 * Maps COCO-80 (and compatible) class names to Lucide icons.
 * Used wherever detected object labels need a visual indicator
 * (notifications, event cards, filters, etc.).
 *
 * To add a new class, add an entry to `classIconMap` below.
 * Unknown classes fall back to a generic Tag icon.
 */

import {
  Armchair,
  Apple,
  Baby,
  Backpack,
  Banana,
  Bed,
  Bike,
  Bird,
  BookOpen,
  Briefcase,
  Bus,
  CakeSlice,
  Car,
  Carrot,
  Cat,
  Citrus,
  Clock,
  Coffee,
  Dog,
  Flower,
  Flower2,
  Hamburger,
  Keyboard,
  Laptop,
  LeafyGreen,
  Microwave,
  Mouse,
  Octagon,
  ParkingMeter,
  PawPrint,
  PersonStanding,
  Pizza,
  Plane,
  Refrigerator,
  Sailboat,
  Sandwich,
  Scissors,
  ShoppingBag,
  Smartphone,
  Sofa,
  SearchCheck,
  TrainFront,
  Truck,
  Tv,
  Umbrella,
  Utensils,
  Wine,
  type LucideIcon,
} from 'lucide-react';

/**
 * Maps object detection class names (lowercase) to Lucide icons.
 * Covers all 80 COCO classes where a reasonable icon exists.
 */
const classIconMap: Record<string, LucideIcon> = {
  // -- People & animals --
  person: PersonStanding,
  bird: Bird,
  cat: Cat,
  dog: Dog,
  horse: PawPrint,
  sheep: PawPrint,
  cow: PawPrint,
  elephant: PawPrint,
  bear: PawPrint,
  zebra: PawPrint,
  giraffe: PawPrint,

  // -- Vehicles --
  bicycle: Bike,
  car: Car,
  motorcycle: Bike,
  airplane: Plane,
  bus: Bus,
  train: TrainFront,
  truck: Truck,
  boat: Sailboat,

  // -- Street objects --
  'stop sign': Octagon,
  'parking meter': ParkingMeter,

  // -- Accessories --
  backpack: Backpack,
  umbrella: Umbrella,
  handbag: ShoppingBag,
  suitcase: Briefcase,

  // -- Food --
  banana: Banana,
  apple: Apple,
  sandwich: Sandwich,
  orange: Citrus,
  broccoli: LeafyGreen,
  carrot: Carrot,
  'hot dog': Hamburger,
  pizza: Pizza,
  cake: CakeSlice,

  // -- Dining --
  bottle: Wine,
  'wine glass': Wine,
  cup: Coffee,
  fork: Utensils,
  knife: Utensils,
  spoon: Utensils,

  // -- Furniture --
  chair: Armchair,
  couch: Sofa,
  'potted plant': Flower2,
  bed: Bed,
  'dining table': Utensils,

  // -- Electronics --
  tv: Tv,
  laptop: Laptop,
  mouse: Mouse,
  remote: Smartphone,
  keyboard: Keyboard,
  'cell phone': Smartphone,
  microwave: Microwave,
  refrigerator: Refrigerator,

  // -- Misc --
  book: BookOpen,
  clock: Clock,
  vase: Flower,
  scissors: Scissors,
  'teddy bear': Baby,
};

/** Fallback icon for classes without a specific mapping. */
const fallbackIcon: LucideIcon = SearchCheck;

/**
 * Returns the Lucide icon for an object detection class name.
 *
 * Lookup is case-insensitive. Unknown classes return a Tag icon.
 *
 * @param className - Detection class label (e.g. "person", "car", "Dog")
 */
export function getObjectClassIcon(className: string): LucideIcon {
  return classIconMap[className.toLowerCase()] ?? fallbackIcon;
}

/**
 * Returns true if the class name has a specific icon (not the fallback).
 */
export function hasObjectClassIcon(className: string): boolean {
  return className.toLowerCase() in classIconMap;
}

/**
 * Given a comma-separated list of class names (e.g. "car,person"),
 * returns the icon for the first class.
 */
export function getObjectClassIconFromList(classList: string): LucideIcon {
  const first = classList.split(',')[0].trim();
  return first ? getObjectClassIcon(first) : fallbackIcon;
}
