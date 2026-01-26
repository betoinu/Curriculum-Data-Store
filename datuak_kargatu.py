import json
import os
from supabase import create_client
from dotenv import load_dotenv 

# .env fitxategia kargatu - GEHITU HAU
load_dotenv()

# Zure Supabase datuak .env fitxategitik - ALDATU HAU
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Debug informazioa - GEHITU HAU
print(f"URL: {SUPABASE_URL}")
print(f"KEY luzeera: {len(SUPABASE_KEY) if SUPABASE_KEY else 0}")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def json_datuak_kargatu():
    # 1. JSON fitxategia ireki
    with open('curriculum_eguneratua_2025-11-27.json', 'r', encoding='utf-8') as f:
        datuak = json.load(f)
    
    print("Datuak kargatzen hasi...")
    
    # 2. Gradu bakoitza prozesatu
    for gradu_izena, mailak in datuak.items():
        print(f"Gradua prozesatzen: {gradu_izena}")
        
        # 2.1. Gradua taulan sartu
        gradu_response = supabase.table('graduak').insert({
            'izena': gradu_izena
        }).execute()
        
        if not gradu_response.data:
            print(f"Errorea {gradu_izena} gradua sartzean")
            continue
            
        gradu_id = gradu_response.data[0]['id']
        
        # 2.2. Maila bakoitzeko ikasgaiak prozesatu
        for maila, ikasgaiak_lista in mailak.items():
            for ikasgaia in ikasgaiak_lista:
                # 2.3. Ikasgaia sartu
                ikasgai_response = supabase.table('ikasgaiak').insert({
                    'gradu_id': gradu_id,
                    'maila': int(maila),
                    'izena': ikasgaia['izena'],
                    'mota': ikasgaia.get('mota'),
                    'kredituak': ikasgaia.get('kredituak'),
                    'currentofficialras': ikasgaia.get('currentOfficialRAs', [])
                }).execute()
                
                if not ikasgai_response.data:
                    print(f"Errorea {ikasgaia['izena']} ikasgaia sartzean")
                    continue
                    
                ikasgai_id = ikasgai_response.data[0]['id']
                
                # 2.4. Unitateak sartu (baditu)
                for unitatea in ikasgaia.get('unitateak', []):
                    supabase.table('unitateak').insert({
                        'ikasgai_id': ikasgai_id,
                        'unitate_id': unitatea.get('id'),
                        'izena': unitatea.get('izena'),
                        'edukiak': unitatea.get('edukiak'),
                        'data': unitatea.get('data')
                    }).execute()
    
    print("Datuak kargatu dira!")

# Script-a exekutatu
if __name__ == "__main__":
    json_datuak_kargatu()