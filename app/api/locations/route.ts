// app/api/locations/route.ts
import { NextResponse } from 'next/server';
import { ALL_LOCATIONS } from '../../../lib/locationsData';

export async function GET() {
  return NextResponse.json({
    success: true,
    locations: ALL_LOCATIONS,
  });
}