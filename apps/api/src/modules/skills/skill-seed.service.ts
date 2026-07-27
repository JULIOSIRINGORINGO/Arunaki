import { Injectable, Logger } from '@nestjs/common';
import { SkillService } from './skill.service.js';

/**
 * Seeds starter skills for each domain.
 * Called once on application startup.
 */
@Injectable()
export class SkillSeedService {
  private readonly logger = new Logger(SkillSeedService.name);

  constructor(private readonly skillService: SkillService) {}

  async seedAll(): Promise<void> {
    this.logger.log('Seeding starter skills...');

    await this.seedGarmentSkills();
    await this.seedRestaurantSkills();
    await this.seedRetailSkills();
    await this.seedGenericSkills();

    this.logger.log('Starter skills seeding complete.');
  }

  private async seedGarmentSkills(): Promise<void> {
    await this.skillService.seedStarterSkills('garment', [
      {
        name: 'rekap-penjualan-kain',
        displayName: 'Rekap Penjualan Kain',
        description:
          'Merangkum data penjualan kain per periode dengan format standar',
        category: 'reporting',
        content: `# Rekap Penjualan Kain

## Format Output
Ringkasan penjualan kain harus mencakup:
- Periode (harian/mingguan/bulanan)
- Total yard/meter terjual
- Breakdown per jenis kain
- Total revenue
- Top 5 kain terlaris

## Kolom Tabel
| Jenis Kain | Warna | Yard/Meter | Harga/meter | Total | % Kontribusi |

## Aturan
- Selalu gunakan satuan yang konsisten (yard atau meter, jangan campur)
- Kontribusi = (total per item / total keseluruhan) x 100%
- Tunjukkan 3 decimal place untuk persentase`,
        tags: ['penjualan', 'kain', 'rekap', 'laporan'],
      },
      {
        name: 'hitung-hpp-garment',
        displayName: 'Hitung HPP Garment',
        description: 'Menghitung Harga Pokok Produksi untuk item garment',
        category: 'data-processing',
        content: `# Hitung HPP (Harga Pokok Produksi) Garment

## Komponen HPP
1. **Bahan Baku**: Kain, benang, aksesoris (resleting, kancing, label)
2. **Tenaga Kerja Langsung**: Jahit, obras, potong
3. **Overhead Pabrik**: Listrik, air, sewa mesin

## Rumus
HPP = (Bahan Baku + TKL + Overhead) / Jumlah Produksi

## Format Output
| Komponen | Deskripsi | Biaya/unit |
|----------|-----------|------------|
| Bahan Baku | [detail] | Rp X |
| TKL | [detail] | Rp X |
| Overhead | [detail] | Rp X |
| **TOTAL HPP** | | **Rp X** |

## Aturan
- Selalu dalam Rupiah (IDR)
- Tampilkan detail setiap komponen
- Hitung margin: Harga Jual - HPP = Laba Kotor`,
        tags: ['hpp', 'produksi', 'garment', 'kalkulasi'],
      },
      {
        name: 'cek-stok-kain',
        displayName: 'Cek Stok Kain',
        description: 'Memeriksa dan melaporkan status stok kain',
        category: 'data-processing',
        content: `# Cek Stok Kain

## Format Laporan
Untuk setiap jenis kain, tampilkan:
- Nama kain & warna
- Stok saat ini (yard/meter)
- Stok minimum
- Status: Aman / Habis / Perlu Restock
- Rekomendasi reorder

## Aturan
- Status "Habis" = stok = 0
- Status "Perlu Restock" = stok < stok minimum
- Status "Aman" = stok >= stok minimum
- Urutkan dari yang paling mendesak (habis dulu)`,
        tags: ['stok', 'kain', 'inventory', 'garment'],
      },
    ]);
  }

  private async seedRestaurantSkills(): Promise<void> {
    await this.skillService.seedStarterSkills('restaurant', [
      {
        name: 'rekap-penjualan-menu',
        displayName: 'Rekap Penjualan Menu',
        description: 'Merangkum penjualan menu restoran per periode',
        category: 'reporting',
        content: `# Rekap Penjualan Menu

## Format Output
- Periode (harian/mingguan/bulanan)
- Total porsi terjual
- Breakdown per kategori (makanan/minuman/snack)
- Top 5 menu terlaris
- Menu paling sedikit terjual

## Kolom Tabel
| Menu | Kategori | Porsi Terjual | Harga | Revenue | % |

## Aturan
- Tunjukkan menu yang perlu dipromosikan (bottom 3)
- Hitung rata-rata revenue per porsi
- Bandingkan dengan periode sebelumnya jika ada`,
        tags: ['penjualan', 'menu', 'restoran', 'laporan'],
      },
      {
        name: 'hitung-hpp-menu',
        displayName: 'Hitung HPP Menu',
        description: 'Menghitung Harga Pokok Produksi per menu',
        category: 'data-processing',
        content: `# Hitung HPP Menu

## Komponen
1. **Bahan Baku**: Bahan mentah, bumbu, bungkus
2. **Tenaga Kerja**: Koki, pelayan (dibagi rata)
3. **Overhead**: Sewa, listrik, gas

## Rumus
HPP/porsi = Total Biaya / Total Porsi

## Format
| Komponen | Biaya/Resep | Porsi | HPP/porsi |
|----------|-------------|-------|-----------|

## Aturan
- Tampilkan food cost percentage: (HPP / Harga Jual) x 100%
- Target: food cost <= 35%
- Flag menu yang melebihi target`,
        tags: ['hpp', 'menu', 'restoran', 'kalkulasi'],
      },
    ]);
  }

  private async seedRetailSkills(): Promise<void> {
    await this.skillService.seedStarterSkills('retail', [
      {
        name: 'rekap-penjualan-produk',
        displayName: 'Rekap Penjualan Produk',
        description: 'Merangkum penjualan produk retail per periode',
        category: 'reporting',
        content: `# Rekap Penjualan Produk

## Format Output
- Periode
- Total unit terjual
- Revenue total
- Top 10 produk terlaris
- Produk zero-sale (tidak laku)

## Kolom Tabel
| SKU | Produk | Unit Terjual | Harga | Revenue | Profit | % |

## Aturan
- Sort by revenue (highest first)
- Hitung profit margin per produk
- Flag produk dengan margin < 10%`,
        tags: ['penjualan', 'produk', 'retail', 'laporan'],
      },
      {
        name: 'analisis-stok-retail',
        displayName: 'Analisis Stok Retail',
        description: 'Menganalisis status inventori dan memberikan rekomendasi',
        category: 'data-processing',
        content: `# Analisis Stok Retail

## Output
- Daftar produk dengan stok kritis (di bawah minimum)
- Produk overstock (di atas maximum)
- Nilai total inventori
- Rekomendasi reorder (quantity & priorititas)

## Aturan
- Kategori: Kritis / Overstock / Normal
- Hitung days of supply: stok / rata-rata penjualan harian
- Prioritas reorder berdasarkan velocity penjualan`,
        tags: ['stok', 'inventori', 'retail', 'analisis'],
      },
    ]);
  }

  private async seedGenericSkills(): Promise<void> {
    await this.skillService.seedStarterSkills('generic', [
      {
        name: 'rekap-data-umum',
        displayName: 'Rekap Data Umum',
        description: 'Merangkum data tabular dalam format ringkas',
        category: 'reporting',
        content: `# Rekap Data Umum

## Format Output
- Ringkasan statistik: total, rata-rata, min, max
- Breakdown per kategori
- Trend jika ada data waktu

## Aturan
- Gunakan format yang sesuai dengan jenis data
- Tunjukkan insight utama (top 3 poin)
- Rekomendasi aksi jika ada anomali`,
        tags: ['rekap', 'data', 'umum', 'ringkasan'],
      },
    ]);
  }
}
