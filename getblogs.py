import os
import json

arrayres = []

for root, dirs, files in os.walk("./blog", topdown=False):
    for name in files:
    	if name[0] != ".":
	        arrayres.append(name)

print json.dumps(arrayres, separators=(',',':'))